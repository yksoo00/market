package com.company.market.trade.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.dto.CartAddRequest;
import com.company.market.trade.dto.CartAddResponse;
import com.company.market.trade.dto.CartCountResponse;
import com.company.market.trade.dto.CartItemResponse;
import com.company.market.trade.repository.CartInfoRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 장바구니 (설계 2026-10-27 PR 3). 한 건 = trd_trade_info 의 구매검토/장바구니 행 + trd_cart_info 행(같은 거래ID), 구매자·매물당 하나.
 * 목록·개수는 trd_cart_info 에서 읽는다. 빼면 두 행을 지우고, 구매·견적으로 넘어가면 TradeService 가 그 거래 행을 바꿔 쓴다. 재고·메일 없음.
 */
@Service
@RequiredArgsConstructor
public class CartService {

	public static final int MAX_ITEMS = 100;

	private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private final TradeInfoRepository trades;

	private final CartInfoRepository cartInfos;

	private final TradeIdGenerator tradeIds;

	private final TradeInputRules rules;

	private final ListingService listings;

	private final Clock clock;

	/**
	 * 담기. 하나라도 틀리면(내 매물·거래완료·없는 매물·입력 오류·100개 초과) 아무것도 안 담는다 — 다 확인한 뒤에 쓴다.
	 * 이미 담긴 매물은 건너뛰고 처음 값을 유지한다(skipped 로 알림). 동시에 담은 두 요청이 같이 100개 확인을 통과하면 조금 넘을 수 있다
	 * (감수 — 행 수 상한이 목적이고 구매자 한 명 안의 경합이라)
	 */
	@Transactional
	public CartAddResponse add(UUID buyerId, CartAddRequest req) {
		Map<String, Integer> firstIndex = new LinkedHashMap<>();
		Map<String, ListingTradeSnapshot> targets = new LinkedHashMap<>();
		Map<String, String> failures = new LinkedHashMap<>();
		for (int i = 0; i < req.items().size(); i++) {
			CartAddRequest.Item item = req.items().get(i);
			String key = item.sellerId() + "/" + item.regDate();
			if (firstIndex.containsKey(key)) {
				continue;
			}
			firstIndex.put(key, i);
			ListingTradeSnapshot listing = listings.snapshotForTrade(item.sellerId(), item.regDate());
			if (buyerId.equals(listing.sellerId())) {
				throw new ApiException(ErrorCode.TRADE_OWN_LISTING);
			}
			if (listing.completed()) {
				throw new ApiException(ErrorCode.LISTING_COMPLETED);
			}
			// 재고는 보지 않는다 — 재고가 모자라도 나중에 살 수 있어 담아 둔다 (구매 때 다시 본다)
			String prefix = "items[" + i + "].";
			String quantityFailure = rules.quantityFailure(listing, item.orderQuantity(),
					listing.salesUnitPrice() == null ? 0 : listing.salesUnitPrice());
			if (quantityFailure != null) {
				failures.put(prefix + "orderQuantity", quantityFailure);
			}
			String dateFailure = rules.reqDeliDateFailure(item.reqDeliDate());
			if (dateFailure != null) {
				failures.put(prefix + "reqDeliDate", dateFailure);
			}
			targets.put(key, listing);
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
		List<String> fresh = targets.keySet().stream().filter(key -> {
			ListingTradeSnapshot l = targets.get(key);
			return !cartInfos.existsByUserIdAndCartTypeAndSellerIdAndProdDateAndProdNo(buyerId, CartType.CART, l.sellerId(),
					l.regDate(), l.prodId());
		}).toList();
		if (cartInfos.countByUserIdAndCartType(buyerId, CartType.CART) + fresh.size() > MAX_ITEMS) {
			throw new ApiException(ErrorCode.CART_FULL);
		}
		String now = LocalDateTime.now(clock).format(TIMESTAMP_FORMAT);
		int added = 0;
		for (String key : fresh) {
			ListingTradeSnapshot l = targets.get(key);
			CartAddRequest.Item item = req.items().get(firstIndex.get(key));
			String remarks = item.remarks() == null || item.remarks().isBlank() ? null : item.remarks().trim();
			String tradeId = tradeIds.next();
			int unitPrice = l.salesUnitPrice() == null ? 0 : l.salesUnitPrice();
			// 0 이면 동시에 담은 다른 요청이 먼저 담았다 — 건너뛴 것으로 센다
			if (trades.insertReviewIfAbsent(buyerId, tradeId, l.sellerId(), l.regDate(), now, l.prodId(), l.prodState(),
					l.salesUnitPrice(), l.stockQuantity(), l.minOrderQuantity(), l.orderUnit(), l.provDate(), unitPrice,
					item.orderQuantity(), item.reqDeliDate(), remarks, TradeStats.CART.label()) == 1) {
				cartInfos.save(cartInfo(buyerId, tradeId, CartType.CART, l, unitPrice, item.orderQuantity(), item.reqDeliDate(),
						remarks, now));
				added++;
			}
		}
		return new CartAddResponse(cartInfos.countByUserIdAndCartType(buyerId, CartType.CART), added, targets.size() - added);
	}

	/** trd_cart_info 한 행 — 상품 값은 담을 때 복사. 빈 사양은 '' (정의서 NOT NULL) */
	CartInfo cartInfo(UUID buyerId, String tradeId, CartType type, ListingTradeSnapshot l, int unitPrice, int quantity,
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
			.mufcDate(l.mufcDate())
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

	/** 최근에 담은 것부터. 매물 값은 지금 값 */
	@Transactional(readOnly = true)
	public List<CartItemResponse> list(UUID buyerId) {
		return items(cartInfos.findByUserIdAndCartTypeOrderByTradeIdDesc(buyerId, CartType.CART));
	}

	List<CartItemResponse> items(List<CartInfo> rows) {
		Map<ListingId, ListingSearchItemResponse> items = listings
			.searchItems(rows.stream().map(c -> new ListingId(c.getSellerId(), c.getProdDate(), c.getProdNo())).toList());
		List<CartItemResponse> result = new ArrayList<>();
		for (CartInfo c : rows) {
			ListingSearchItemResponse item = items.get(new ListingId(c.getSellerId(), c.getProdDate(), c.getProdNo()));
			// 매물이 없어졌어도(FK 가 없다) 목록 전체를 깨지 않는다 — 매물 삭제가 이 행도 지우지만 방어
			if (item != null) {
				result.add(new CartItemResponse(c.getTradeId(), c.getOrderQuantity(), c.getReqDeliDate(), c.getRemarks(), item));
			}
		}
		return result;
	}

	@Transactional(readOnly = true)
	public CartCountResponse count(UUID buyerId) {
		return new CartCountResponse(cartInfos.countByUserIdAndCartType(buyerId, CartType.CART));
	}

	/** 빼기. 내 장바구니 행이 아닌 게 하나라도 있으면 404 로 전부 되돌린다 */
	@Transactional
	public void remove(UUID buyerId, List<String> tradeIds) {
		Set<String> ids = new LinkedHashSet<>(tradeIds);
		if (trades.deleteCartRows(buyerId, ids, TradeStats.CART) != ids.size()) {
			throw new ApiException(ErrorCode.TRADE_NOT_FOUND);
		}
		cartInfos.deleteByUserAndTradeIds(buyerId, ids);
	}

}
