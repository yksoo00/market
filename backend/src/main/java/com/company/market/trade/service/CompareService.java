package com.company.market.trade.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.CartInfo;
import com.company.market.trade.domain.CartType;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.dto.CartAddResponse;
import com.company.market.trade.dto.CartItemResponse;
import com.company.market.trade.dto.CompareRequest;
import com.company.market.trade.repository.CartInfoRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 비교 (설계 2026-10-27 PR 3, 사용자 결정 2026-10-29, 누적 2026-11-03). 내 비교용 행(trd_trade_info 구매검토/비교용 +
 * trd_cart_info)은 쌓인다 — 같은 소분류 최대 4개. 담기(add)는 더하고, 교체(replace)·비우기(clear)만 지운다.
 * 입력은 없다: 수량 = 최소주문량, 납품희망일 = 제공가능일. 거래완료 매물도 비교할 수 있다(보기만). 재고·메일 없음
 */
@Service
@RequiredArgsConstructor
public class CompareService {

	// 비교 화면이 2개 이상일 때만 표를 보이지만, 담기는 하나씩이라 서버는 1개부터 받는다
	public static final int MIN_ITEMS = 1;

	public static final int MAX_ITEMS = 4;

	private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private final TradeInfoRepository trades;

	private final CartInfoRepository cartInfos;

	private final TradeIdGenerator tradeIds;

	private final CartService cart;

	private final ListingService listings;

	private final Clock clock;

	/**
	 * 비교 목록 교체([비우고 새로 담기]). 확인(개수·내 매물·없는 매물·소분류)이 모두 끝난 뒤에만 이전 목록을 지운다 — 틀리면 이전 목록 그대로.
	 * 구매자별 잠금으로 지우고 담는 사이에 같은 구매자의 다른 요청이 끼지 않게 한다
	 */
	@Transactional
	public int replace(UUID buyerId, CompareRequest req) {
		Map<String, CompareRequest.Item> unique = uniqueItems(req);
		if (unique.size() < MIN_ITEMS || unique.size() > MAX_ITEMS) {
			throw new ApiException(ErrorCode.COMPARE_COUNT);
		}
		trades.lockCompare(buyerId);
		List<ListingTradeSnapshot> targets = snapshotsOf(buyerId, unique.values());
		if (targets.stream().map(ListingTradeSnapshot::categoryCode).distinct().count() > 1) {
			throw new ApiException(ErrorCode.COMPARE_CATEGORY_MISMATCH);
		}
		deleteAll(buyerId);
		insertRows(buyerId, targets);
		return targets.size();
	}

	/**
	 * 비교 목록에 더하기. 이미 담긴 매물은 건너뛴다. 기존 + 새 것이 4개를 넘거나 소분류가 하나가 아니면 아무것도 안 담고 거절 —
	 * 기존 목록은 그대로. 응답은 담은 뒤 전체 개수와 새로 담은 개수
	 */
	@Transactional
	public CartAddResponse add(UUID buyerId, CompareRequest req) {
		Map<String, CompareRequest.Item> unique = uniqueItems(req);
		if (unique.size() > MAX_ITEMS) {
			throw new ApiException(ErrorCode.COMPARE_FULL);
		}
		trades.lockCompare(buyerId);
		List<CartInfo> existing = cartInfos.findByUserIdAndCartTypeOrderBySerNo(buyerId, CartType.COMPARE);
		Set<String> have = new HashSet<>();
		for (CartInfo c : existing) {
			have.add(c.getSellerId() + "/" + c.getProdDate());
		}
		unique.keySet().removeAll(have);
		if (unique.isEmpty()) {
			return new CartAddResponse(existing.size(), 0);
		}
		List<ListingTradeSnapshot> targets = snapshotsOf(buyerId, unique.values());
		if (existing.size() + targets.size() > MAX_ITEMS) {
			throw new ApiException(ErrorCode.COMPARE_FULL);
		}
		Set<String> categories = targets.stream().map(ListingTradeSnapshot::categoryCode).collect(Collectors.toSet());
		if (!existing.isEmpty()) {
			CartInfo first = existing.get(0);
			categories.add(listings.snapshotForTrade(first.getSellerId(), first.getProdDate()).categoryCode());
		}
		if (categories.size() > 1) {
			throw new ApiException(ErrorCode.COMPARE_CATEGORY_MISMATCH);
		}
		insertRows(buyerId, targets);
		return new CartAddResponse(existing.size() + targets.size(), targets.size());
	}

	/** [비교 비우기] — 내 비교 목록 전부 삭제 */
	@Transactional
	public void clear(UUID buyerId) {
		trades.lockCompare(buyerId);
		deleteAll(buyerId);
	}

	/** 담은 순서. 매물 값은 지금 값 */
	@Transactional(readOnly = true)
	public List<CartItemResponse> list(UUID buyerId) {
		return cart.items(cartInfos.findByUserIdAndCartTypeOrderBySerNo(buyerId, CartType.COMPARE));
	}

	/** 한 열 빼기. 내 비교 행이 아닌 게 하나라도 있으면 404 로 전부 되돌린다 */
	@Transactional
	public void remove(UUID buyerId, List<String> tradeIds) {
		Set<String> ids = new LinkedHashSet<>(tradeIds);
		if (trades.deleteCartRows(buyerId, ids, TradeStats.COMPARE) != ids.size()) {
			throw new ApiException(ErrorCode.TRADE_NOT_FOUND);
		}
		cartInfos.deleteByUserAndTradeIds(buyerId, ids);
	}

	/** 같은 매물을 여러 번 보내도 한 번만 (보낸 순서 유지) */
	private static Map<String, CompareRequest.Item> uniqueItems(CompareRequest req) {
		Map<String, CompareRequest.Item> unique = new LinkedHashMap<>();
		for (CompareRequest.Item item : req.items()) {
			unique.putIfAbsent(item.sellerId() + "/" + item.regDate(), item);
		}
		return unique;
	}

	/** 매물 지금 값. 없는 매물은 404, 내 매물은 403 */
	private List<ListingTradeSnapshot> snapshotsOf(UUID buyerId, Collection<CompareRequest.Item> items) {
		List<ListingTradeSnapshot> targets = items.stream().map(i -> listings.snapshotForTrade(i.sellerId(), i.regDate())).toList();
		for (ListingTradeSnapshot l : targets) {
			if (buyerId.equals(l.sellerId())) {
				throw new ApiException(ErrorCode.TRADE_OWN_LISTING);
			}
		}
		return targets;
	}

	private void deleteAll(UUID buyerId) {
		trades.deleteByUserAndTypeAndStats(buyerId, TradeType.REVIEW, TradeStats.COMPARE);
		cartInfos.deleteByUserAndType(buyerId, CartType.COMPARE);
	}

	private void insertRows(UUID buyerId, List<ListingTradeSnapshot> targets) {
		String now = LocalDateTime.now(clock).format(TIMESTAMP_FORMAT);
		for (ListingTradeSnapshot l : targets) {
			int quantity = l.minOrderQuantity() == null || l.minOrderQuantity() < 1 ? 1 : l.minOrderQuantity();
			int unitPrice = l.salesUnitPrice() == null ? 0 : l.salesUnitPrice();
			String tradeId = tradeIds.next();
			trades.insertReviewIfAbsent(buyerId, tradeId, l.sellerId(), l.regDate(), now, l.prodId(), l.prodState(),
					l.salesUnitPrice(), l.stockQuantity(), l.minOrderQuantity(), l.orderUnit(), l.provDate(), unitPrice, quantity,
					l.provDate(), null, TradeStats.COMPARE.label());
			cartInfos.save(cart.cartInfo(buyerId, tradeId, CartType.COMPARE, l, unitPrice, quantity, l.provDate(), null, now));
		}
	}

}
