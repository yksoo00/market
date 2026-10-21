package com.company.market.trade.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingSearchItemResponse;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.dto.CartAddRequest;
import com.company.market.trade.dto.CartCountResponse;
import com.company.market.trade.dto.CartItemResponse;
import com.company.market.trade.repository.TradeInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 장바구니 (스펙 2026-10-21-cart-design.md). trd_trade_info 의 구매검토/장바구니 행, 구매자·매물당 하나.
 * 기록으로 남기지 않는다 — 빼면 행을 지우고, 견적·구매로 넘어가면 TradeService 가 지운다. 재고·메일 없음.
 */
@Service
@RequiredArgsConstructor
public class CartService {

	public static final int MAX_ITEMS = 100;

	private final TradeInfoRepository trades;

	private final TradeIdGenerator tradeIds;

	private final ListingService listings;

	/**
	 * 담기. 하나라도 틀리면(내 매물·거래완료·없는 매물·100개 초과) 아무것도 안 담는다 — 다 확인한 뒤에 쓴다.
	 * 이미 담긴 매물은 건너뛴다. 동시에 담은 두 요청이 같이 100개 확인을 통과하면 조금 넘을 수 있다(감수 — 행 수 상한이
	 * 목적이고 구매자 한 명 안의 경합이라)
	 */
	@Transactional
	public CartCountResponse add(UUID buyerId, CartAddRequest req) {
		Map<String, ListingTradeSnapshot> targets = new LinkedHashMap<>();
		for (CartAddRequest.Item item : req.items()) {
			String key = item.sellerId() + "/" + item.regDate();
			if (targets.containsKey(key)) {
				continue;
			}
			ListingTradeSnapshot listing = listings.snapshotForTrade(item.sellerId(), item.regDate());
			if (buyerId.equals(listing.sellerId())) {
				throw new ApiException(ErrorCode.TRADE_OWN_LISTING);
			}
			if (listing.completed()) {
				throw new ApiException(ErrorCode.LISTING_COMPLETED);
			}
			targets.put(key, listing);
		}
		List<ListingTradeSnapshot> fresh = targets.values().stream()
			.filter(l -> !trades.existsByUserIdAndSellerIdAndRegDateAndTradeStats(buyerId, l.sellerId(), l.regDate(), TradeStats.CART))
			.toList();
		if (trades.countByUserIdAndTradeStats(buyerId, TradeStats.CART) + fresh.size() > MAX_ITEMS) {
			throw new ApiException(ErrorCode.CART_FULL);
		}
		for (ListingTradeSnapshot l : fresh) {
			// 화면은 이 값이 아니라 지금 매물 값을 보여 준다. NOT NULL 칸이라 담을 때 값으로 채운다
			trades.insertCartIfAbsent(buyerId, tradeIds.next(), l.sellerId(), l.regDate(), l.prodId(), l.prodState(),
					l.salesUnitPrice(), l.stockQuantity(), l.minOrderQuantity(), l.orderUnit(), l.provDate(),
					l.salesUnitPrice() == null ? 0 : l.salesUnitPrice(),
					l.minOrderQuantity() == null || l.minOrderQuantity() < 1 ? 1 : l.minOrderQuantity());
		}
		return count(buyerId);
	}

	/** 최근에 담은 것부터. 매물 값은 지금 값 */
	public List<CartItemResponse> list(UUID buyerId) {
		List<TradeInfo> rows = trades.findByUserIdAndTradeStatsOrderByTradeIdDesc(buyerId, TradeStats.CART);
		Map<ListingId, ListingSearchItemResponse> items = listings
			.searchItems(rows.stream().map(t -> new ListingId(t.getSellerId(), t.getRegDate())).toList());
		List<CartItemResponse> result = new ArrayList<>();
		for (TradeInfo t : rows) {
			ListingSearchItemResponse item = items.get(new ListingId(t.getSellerId(), t.getRegDate()));
			// 매물 FK 가 걸려 있어 없을 수 없지만, 있어도 목록 전체를 깨지 않는다
			if (item != null) {
				result.add(new CartItemResponse(t.getTradeId(), item));
			}
		}
		return result;
	}

	public CartCountResponse count(UUID buyerId) {
		return new CartCountResponse(trades.countByUserIdAndTradeStats(buyerId, TradeStats.CART));
	}

	/** 빼기. 내 장바구니 행이 아닌 게 하나라도 있으면 404 로 전부 되돌린다 */
	@Transactional
	public void remove(UUID buyerId, List<String> tradeIds) {
		Set<String> ids = new LinkedHashSet<>(tradeIds);
		if (trades.deleteCartRows(buyerId, ids, TradeStats.CART) != ids.size()) {
			throw new ApiException(ErrorCode.TRADE_NOT_FOUND);
		}
	}

}
