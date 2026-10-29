package com.company.market.trade.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.company.market.common.exception.ValidationException;
import com.company.market.common.paging.PageKeys;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingPageResponse;
import com.company.market.listing.dto.ListingSearchCondition;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.TradeHistory;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.dto.TradeHistoryItemResponse;
import com.company.market.trade.dto.TradeHistoryPageResponse;
import com.company.market.trade.dto.TradeScopesResponse;
import com.company.market.trade.repository.TradeHistoryRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 활동 읽기 전용 모음 (설계 2026-10-27 PR 4): 내 거래이력, 검색 범위 탭 판정, 내 구매 매물 검색.
 * 본인 id 는 항상 인증 정보에서 받는다. 매물은 ListingService 로만 다룬다 (거래 → 매물 방향).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TradeActivityService {

	private static final int PAGE_SIZE = 20;

	/** 내 구매 범위로 검색할 때 한 번에 거는 매물 수 상한 (최근 거래한 매물부터). IN 조건이 끝없이 길어지지 않게 */
	static final int PURCHASED_KEYS_MAX = 500;

	private final TradeHistoryRepository histories;

	private final TradeInfoRepository trades;

	private final ListingService listings;

	private final UserDirectory userDirectory;

	/** side = all | buy | sell. 최신 확정순 20줄 + 커서(확정일시 14자 + 거래ID) */
	public TradeHistoryPageResponse history(UUID me, String side, String cursor, Integer pageNo) {
		if (!Set.of("all", "buy", "sell").contains(side == null ? "all" : side)) {
			throw new ValidationException(Map.of("side", "side 는 all, buy, sell 중 하나여야 합니다."));
		}
		if (cursor != null && !cursor.isEmpty() && !cursor.matches("\\d{25}")) {
			throw new ValidationException(Map.of("cursor", "커서 형식이 올바르지 않습니다."));
		}
		boolean hasCursor = cursor != null && !cursor.isEmpty();
		boolean buy = !"sell".equals(side);
		boolean sell = !"buy".equals(side);
		// 페이지 번호 방식이면 같은 조건의 키로 경계를 구해 그 페이지의 앞 줄 키를 커서처럼 쓴다
		PageKeys<Object[]> pageKeys = pageNo == null ? null : PageKeys.of(histories.findKeys(me, buy, sell), pageNo, PAGE_SIZE);
		String from = pageKeys != null ? (pageKeys.after() == null ? null : pageKeys.after()[0] + "" + pageKeys.after()[1]) : (hasCursor ? cursor : null);
		List<TradeHistory> rows = histories.findPage(me, buy, sell, from == null ? null : from.substring(0, 14),
				from == null ? null : from.substring(14), PageRequest.of(0, PAGE_SIZE + 1));
		boolean hasMore = rows.size() > PAGE_SIZE;
		List<TradeHistory> page = hasMore ? rows.subList(0, PAGE_SIZE) : rows;

		// 상품명은 매물이 아니라 상품마스터에서 — 이력 줄은 매물 키를 갖고 있지 않다
		Map<String, String> names = listings.productNames(page.stream().map(TradeHistory::getProdId).collect(Collectors.toSet()));
		Map<UUID, String> nicknames = userDirectory.nicknamesOf(
				page.stream().map(h -> me.equals(h.getUserId()) ? h.getSellerId() : h.getUserId()).collect(Collectors.toSet()));
		List<TradeHistoryItemResponse> items = page.stream().map(h -> {
			boolean asBuyer = me.equals(h.getUserId());
			return new TradeHistoryItemResponse(h.getTradeId(), h.getTradeDate(), asBuyer ? "buy" : "sell", names.get(h.getProdId()),
					nicknames.get(asBuyer ? h.getSellerId() : h.getUserId()), h.getTradeUnitPrice(), h.getTradeQuantity(),
					h.getTradeAmount());
		}).toList();
		TradeHistory last = page.isEmpty() ? null : page.get(page.size() - 1);
		String nextCursor = hasMore ? last.getTradeDate() + last.getTradeId() : null;
		return pageKeys == null ? new TradeHistoryPageResponse(items, nextCursor, null, null, null)
				: new TradeHistoryPageResponse(items, nextCursor, pageKeys.page(), pageKeys.totalPages(), pageKeys.total());
	}

	/** 검색 범위 탭 판정: 내 매물이 있나 / 구매 거래(구매검토 아님)나 거래이력이 있나 */
	public TradeScopesResponse scopes(UUID me) {
		boolean sales = listings.hasListings(me);
		boolean purchases = trades.existsByUserIdAndTradeTypeNot(me, TradeType.REVIEW) || histories.existsByUserId(me);
		return new TradeScopesResponse(sales, purchases);
	}

	/** 내 구매 범위 검색: 내가 거래한 매물(진행 중 + 구매확정)을 같은 필터로. 거래가 없으면 빈 결과 */
	public ListingPageResponse purchasedListings(UUID me, ListingSearchCondition condition) {
		List<ListingId> keys = trades.findPurchasedListings(me, TradeType.REVIEW, PageRequest.of(0, PURCHASED_KEYS_MAX)).stream()
			.map(r -> new ListingId((UUID) r[0], (String) r[1], null))
			.toList();
		return listings.search(condition, null, keys);
	}

}
