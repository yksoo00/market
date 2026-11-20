package com.company.market.trade.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingSearchItemResponse;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.CartInfo;
import com.company.market.trade.domain.CartType;
import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.dto.CartAddRequest;
import com.company.market.trade.dto.CartAddResponse;
import com.company.market.trade.dto.CartCountResponse;
import com.company.market.trade.dto.CartItemResponse;
import com.company.market.trade.dto.CartQuantityResponse;
import com.company.market.trade.repository.CartInfoRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 장바구니 (설계 2026-10-27 PR 3, 묶기 2026-11-02). 한 건 = trd_trade_info 의 구매검토/장바구니 행 + trd_cart_info 행(같은 거래ID).
 * 같은 매물도 담을 때마다 새 줄(새 거래)이고, 담으면 그 수량만큼 재고를 묶는다(stock_quantity 에서 뺌). 빼기·1시간 만료로 줄이 없어지면
 * 되돌린다. 목록·개수는 trd_cart_info 에서 읽는다. 구매·견적으로 넘어가면 TradeService 가 그 줄(cartTradeId)을 바꿔 쓴다. 메일 없음.
 */
@Service
@RequiredArgsConstructor
public class CartService {

	public static final int MAX_ITEMS = 100;

	/** 담은 지 이 시간이 지나면 자동으로 빠지고 묶인 수량이 풀린다 (사용자 결정 2026-11-02) */
	public static final Duration EXPIRE_AFTER = Duration.ofHours(1);

	private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private final TradeInfoRepository trades;

	private final CartInfoRepository cartInfos;

	private final TradeIdGenerator tradeIds;

	private final TradeInputRules rules;

	private final ListingService listings;

	private final Clock clock;

	/**
	 * 담기. 하나라도 틀리면(내 매물·거래완료·없는 매물·입력 오류·재고 초과·100개 초과) 아무것도 안 담는다 — 다 확인한 뒤에 쓴다.
	 * 같은 매물도 담을 때마다 새 줄(새 거래)이다 — 합치지도 바꾸지도 않는다(사용자 결정 2026-11-02). 담으면 그 수량만큼 재고를 묶고,
	 * 모자라면 그 줄의 수량 칸에 오류를 붙인다(items[i].orderQuantity). 같은 요청 안의 같은 매물은 줄마다 차례로 묶는다.
	 * 100개 확인은 동시에 담은 두 요청이 같이 통과하면 조금 넘을 수 있다(감수 — 행 수 상한이 목적이고 구매자 한 명 안의 경합이라)
	 */
	@Transactional
	public CartAddResponse add(String buyerId, CartAddRequest req) {
		Map<String, String> failures = new LinkedHashMap<>();
		// 매물을 배타 잠금으로 읽는다 — 공유 잠금으로 읽고 재고 UPDATE 로 올리면 같은 매물을 동시에 담는 두 요청이 서로를 기다려
		// 교착된다. 여러 매물은 늘 같은 순서(판매자·등록일시)로 잠가 서로 다른 순서로 잠그는 요청끼리도 교착하지 않게 한다
		List<Integer> lockOrder = new ArrayList<>();
		for (int i = 0; i < req.items().size(); i++) {
			lockOrder.add(i);
		}
		lockOrder.sort(Comparator.comparing((Integer i) -> req.items().get(i).sellerId().toString())
			.thenComparing(i -> req.items().get(i).regDate()));
		ListingTradeSnapshot[] snapshots = new ListingTradeSnapshot[req.items().size()];
		Map<String, ListingTradeSnapshot> locked = new HashMap<>();
		for (int i : lockOrder) {
			CartAddRequest.Item item = req.items().get(i);
			snapshots[i] = locked.computeIfAbsent(item.sellerId() + "/" + item.regDate(), k -> listings.lockForTrade(item.sellerId(), item.regDate()));
		}
		List<ListingTradeSnapshot> targets = new ArrayList<>();
		for (int i = 0; i < req.items().size(); i++) {
			CartAddRequest.Item item = req.items().get(i);
			ListingTradeSnapshot listing = snapshots[i];
			if (buyerId.equals(listing.sellerId())) {
				throw new ApiException(ErrorCode.TRADE_OWN_LISTING);
			}
			if (listing.completed()) {
				throw new ApiException(ErrorCode.LISTING_COMPLETED);
			}
			String prefix = "items[" + i + "].";
			String quantityFailure = rules.quantityFailure(listing, item.orderQuantity(),
					listing.salesUnitPrice() == null ? 0 : listing.salesUnitPrice());
			// 재고는 아래 묶기(조건부 UPDATE)가 최종 판정한다. 여기서는 뻔한 초과를 먼저 알린다
			if (quantityFailure == null && (listing.stockQuantity() == null || item.orderQuantity() > listing.stockQuantity())) {
				quantityFailure = stockFailure(listing.stockQuantity());
			}
			if (quantityFailure != null) {
				failures.put(prefix + "orderQuantity", quantityFailure);
			}
			String dateFailure = rules.reqDeliDateFailure(item.reqDeliDate());
			if (dateFailure != null) {
				failures.put(prefix + "reqDeliDate", dateFailure);
			}
			targets.add(listing);
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
		if (cartInfos.countByUserIdAndCartType(buyerId, CartType.CART) + targets.size() > MAX_ITEMS) {
			throw new ApiException(ErrorCode.CART_FULL);
		}
		String now = LocalDateTime.now(clock).format(TIMESTAMP_FORMAT);
		for (int i = 0; i < targets.size(); i++) {
			ListingTradeSnapshot l = targets.get(i);
			CartAddRequest.Item item = req.items().get(i);
			// 그 사이 다른 사람이 가져가 모자라졌으면 이 줄에 오류를 붙이고 계속 본다 (끝에서 한꺼번에 되돌린다)
			if (!listings.tryReserveStock(l.id(), item.orderQuantity())) {
				failures.put("items[" + i + "].orderQuantity", stockFailure(currentStock(l)));
				continue;
			}
			String remarks = item.remarks() == null || item.remarks().isBlank() ? null : item.remarks().trim();
			String tradeId = tradeIds.next();
			int unitPrice = l.salesUnitPrice() == null ? 0 : l.salesUnitPrice();
			// 0 이면 거래 행이 안 만들어졌다 — 묶은 수량이 풀리지 않는 줄이 생기지 않게 롤백한다 (거래ID 충돌 같은 있을 수 없는 경우)
			if (trades.insertReviewIfAbsent(buyerId, tradeId, l.sellerId(), l.regDate(), now, l.prodId(), l.prodState(),
					l.salesUnitPrice(), l.stockQuantity(), l.minOrderQuantity(), l.orderUnit(), l.provDate(), unitPrice,
					item.orderQuantity(), item.reqDeliDate(), remarks, TradeStats.CART.label()) != 1) {
				throw new IllegalStateException("장바구니 거래 행을 만들지 못했습니다: " + tradeId);
			}
			cartInfos.save(cartInfo(buyerId, tradeId, CartType.CART, l, unitPrice, item.orderQuantity(), item.reqDeliDate(), remarks, now));
		}
		// 하나라도 못 묶었으면 먼저 묶은 것까지 전부 되돌린다 (트랜잭션 롤백)
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
		return new CartAddResponse(cartInfos.countByUserIdAndCartType(buyerId, CartType.CART), targets.size());
	}

	private static String stockFailure(Integer stock) {
		return "현재 재고(%d)보다 많이 담을 수 없습니다.".formatted(stock == null ? 0 : stock);
	}

	/** 묶기에 실패한 순간의 재고 — 오류 문구에 쓴다 (스냅샷은 담기 시작 전 값이라 다시 읽는다) */
	private Integer currentStock(ListingTradeSnapshot l) {
		return listings.snapshotForTrade(l.sellerId(), l.regDate()).stockQuantity();
	}

	/** trd_cart_info 한 행 — 상품 값은 담을 때 복사. 빈 사양은 '' (정의서 NOT NULL) */
	CartInfo cartInfo(String buyerId, String tradeId, CartType type, ListingTradeSnapshot l, int unitPrice, int quantity,
			String reqDeliDate, String remarks, String now) {
		return CartInfo.builder()
			.userId(buyerId)
			.tradeId(tradeId)
			.serNo(cartInfos.nextSerNo(buyerId))
			.cartType(type)
			.sellerId(l.sellerId())
			.prodDate(l.regDate())
			.prodName(l.prodName() == null ? "" : l.prodName())
			.prodNo(l.prodId())
			.manufacturer(l.manufacturer())
			.prodSpecInfo(l.prodSpecInfo() == null ? "" : l.prodSpecInfo())
			.prodState(l.prodState() == null ? "" : l.prodState())
			.provDate(l.provDate())
			.orderUnitPrice(unitPrice)
			.orderQuantity(quantity)
			.reqDeliDate(reqDeliDate)
			.remarks(remarks)
			.regDate(now)
			.build();
	}

	/**
	 * 담은 수량 바꾸기 (+/-). 담기와 같은 규칙(최소주문량·주문단위·금액 상한)을 보고, 늘린 만큼만 재고를 더 묶고 줄인 만큼만 푼다.
	 * 담은 시각은 그대로 — 수량을 만져 1시간 자동 삭제를 늦출 수 없다(사용자 결정 2026-11-02). 줄을 먼저 잠그고 매물을 잠근다
	 * (자동 삭제·구매·견적 전환과 같은 순서). 내 장바구니 줄이 아니면 404
	 */
	@Transactional
	public CartQuantityResponse changeQuantity(String buyerId, String tradeId, int quantity) {
		TradeInfo row = trades.findForUpdateByTradeId(tradeId)
			.filter(t -> buyerId.equals(t.getUserId()) && t.getTradeType() == TradeType.REVIEW && t.getTradeStats() == TradeStats.CART)
			.orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		// 담은 지 1시간이 지났으면 곧 자동 삭제될 줄이다 — 그 사이에 새 재고를 묶지 않는다
		if (row.getRegDate() == null || row.getRegDate().compareTo(LocalDateTime.now(clock).minus(EXPIRE_AFTER).format(TIMESTAMP_FORMAT)) < 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_FOUND);
		}
		ListingId listingId = row.listingId();
		int before = row.getOrderQuantity();
		ListingTradeSnapshot listing = listings.lockForTrade(listingId);
		if (listing.completed()) {
			throw new ApiException(ErrorCode.LISTING_COMPLETED);
		}
		String failure = rules.quantityFailure(listing, quantity, listing.salesUnitPrice() == null ? 0 : listing.salesUnitPrice());
		int delta = quantity - before;
		if (failure == null && delta > 0 && !listings.tryReserveStock(listingId, delta)) {
			// 줄·매물을 잠근 채 읽은 스냅샷이라 지금 재고다
			failure = stockFailure(listing.stockQuantity());
		}
		if (failure != null) {
			throw new ValidationException(Map.of("orderQuantity", failure));
		}
		if (delta < 0) {
			listings.releaseStock(listingId, -delta);
		}
		trades.updateCartQuantity(tradeId, quantity, TradeStats.CART);
		cartInfos.updateQuantity(tradeId, quantity);
		return new CartQuantityResponse(tradeId, quantity);
	}

	/** 최근에 담은 것부터. 매물 값은 지금 값 */
	@Transactional(readOnly = true)
	public List<CartItemResponse> list(String buyerId) {
		return items(cartInfos.findByUserIdAndCartTypeOrderByTradeIdDesc(buyerId, CartType.CART));
	}

	List<CartItemResponse> items(List<CartInfo> rows) {
		Map<ListingId, ListingSearchItemResponse> items = listings
			// 같은 매물이 여러 줄일 수 있어(2026-11-02) 매물은 한 번씩만 읽는다 — 읽은 값을 줄마다 나눠 쓴다
			.searchItems(rows.stream().map(c -> new ListingId(c.getSellerId(), c.getProdDate(), c.getProdNo())).distinct().toList());
		List<CartItemResponse> result = new ArrayList<>();
		for (CartInfo c : rows) {
			ListingSearchItemResponse item = items.get(new ListingId(c.getSellerId(), c.getProdDate(), c.getProdNo()));
			// 매물이 없어졌어도(FK 가 없다) 목록 전체를 깨지 않는다 — 매물 삭제가 이 행도 지우지만 방어
			if (item != null) {
				result.add(new CartItemResponse(c.getTradeId(), c.getOrderQuantity(), c.getReqDeliDate(), c.getRemarks(), c.getRegDate(), item));
			}
		}
		return result;
	}

	@Transactional(readOnly = true)
	public CartCountResponse count(String buyerId) {
		return new CartCountResponse(cartInfos.countByUserIdAndCartType(buyerId, CartType.CART));
	}

	/** 빼기. 내 장바구니 행이 아닌 게 하나라도 있으면 404 로 전부 되돌린다. 빼면 그 줄이 묶었던 수량이 풀린다 */
	@Transactional
	public void remove(String buyerId, List<String> tradeIds) {
		Set<String> ids = new LinkedHashSet<>(tradeIds);
		for (String id : ids) {
			TradeInfo row = trades.findByTradeId(id)
				.filter(t -> buyerId.equals(t.getUserId()) && t.getTradeType() == TradeType.REVIEW && t.getTradeStats() == TradeStats.CART)
				.orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
			dropAndRelease(row);
		}
	}

	/** 담은 지 EXPIRE_AFTER 가 지난 장바구니 줄의 거래ID — 자동 정리 작업이 한 줄씩 expire 로 지운다 */
	@Transactional(readOnly = true)
	public List<String> staleTradeIds() {
		String cutoff = LocalDateTime.now(clock).minus(EXPIRE_AFTER).format(TIMESTAMP_FORMAT);
		return trades.findStaleTradeIds(TradeType.REVIEW, TradeStats.CART, cutoff);
	}

	/**
	 * 오래된 장바구니 줄 하나를 지우고 묶인 수량을 푼다. 줄마다 따로 트랜잭션 — 한 줄이 실패해도 나머지는 풀린다. 컨테이너 둘이 같이
	 * 돌거나 그 사이 사용자가 먼저 빼도 한 번만 풀리게, 지울 때 상태 조건(장바구니)이 맞아야 하고 지운 줄 수가 1일 때만 푼다.
	 * 그 사이 줄이 바뀌었거나(구매·견적으로 전환) 다시 담겨 이제 오래된 줄이 아니면 건너뛴다. 지운 줄이면 true
	 */
	@Transactional
	public boolean expire(String tradeId) {
		String cutoff = LocalDateTime.now(clock).minus(EXPIRE_AFTER).format(TIMESTAMP_FORMAT);
		TradeInfo row = trades.findForUpdateByTradeId(tradeId)
			.filter(t -> t.getTradeType() == TradeType.REVIEW && t.getTradeStats() == TradeStats.CART && t.getRegDate() != null
					&& t.getRegDate().compareTo(cutoff) < 0)
			.orElse(null);
		return row != null && dropAndRelease(row);
	}

	/** 줄 하나(거래 행 + 장바구니 정보 행)를 지우고, 실제로 지웠을 때만 묶은 수량을 되돌린다 */
	private boolean dropAndRelease(TradeInfo row) {
		ListingId listing = row.listingId();
		int quantity = row.getOrderQuantity();
		String buyerId = row.getUserId();
		String id = row.getTradeId();
		if (trades.deleteCartRows(buyerId, Set.of(id), TradeStats.CART) != 1) {
			return false;
		}
		cartInfos.deleteByUserAndTradeIds(buyerId, Set.of(id));
		// 매물이 이미 없으면 풀 재고도 없다 — 줄만 지우고 끝낸다 (던지면 롤백돼 이 줄이 매분 같은 이유로 영원히 안 지워진다)
		listings.releaseStockIfPresent(listing, quantity);
		return true;
	}

}
