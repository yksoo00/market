package com.company.market.trade.service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
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
import com.company.market.trade.domain.TradeHistoryId;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.dto.TradeFilter;
import com.company.market.trade.dto.TradeHistoryItemResponse;
import com.company.market.trade.dto.TradeHistoryPageResponse;
import com.company.market.trade.dto.TradeScopesResponse;
import com.company.market.trade.repository.TradeHistoryRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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

	/**
	 * side = all | buy | sell. 최신 확정순 20줄 + 커서(확정일시 14자 + 거래ID). 필터(상품명·기간·금액·정렬, 계획 2026-10-30)는
	 * 전부 본인 이력 조건 안에서만 걸린다. 정렬이 최신순이 아니면 page 가 필요하다 (커서는 최신순 전용)
	 */
	public TradeHistoryPageResponse history(UUID me, String side, String cursor, Integer pageNo, TradeFilter filter) {
		if (!Set.of("all", "buy", "sell").contains(side == null ? "all" : side)) {
			throw new ValidationException(Map.of("side", "side 는 all, buy, sell 중 하나여야 합니다."));
		}
		if (cursor != null && !cursor.isEmpty() && !cursor.matches("\\d{25}")) {
			throw new ValidationException(Map.of("cursor", "커서 형식이 올바르지 않습니다."));
		}
		TradeFilterRules.Parsed f = TradeFilterRules.parse(filter, pageNo != null);
		boolean hasCursor = cursor != null && !cursor.isEmpty();
		boolean buy = !"sell".equals(side);
		boolean sell = !"buy".equals(side);
		boolean useProds = f.q() != null;
		// 검색어는 내 이력에 나온 상품 안에서만 맞춰 본다 — 전체 상품에서 찾으면 상한이 필요해 결과가 빠진다 (decisions.md 2026-11-02)
		List<String> prodIds = useProds ? listings.productIdsMatching(f.field(), f.q(), histories.findProdIds(me, buy, sell)) : List.of("");
		if (useProds && prodIds.isEmpty()) {
			// 맞는 상품이 없으면 쿼리 없이 빈 결과. 페이지 번호면 1페이지만 있다
			PageKeys<Object[]> empty = pageNo == null ? null : PageKeys.of(List.of(), pageNo, PAGE_SIZE);
			return empty == null ? new TradeHistoryPageResponse(List.of(), null, null, null, null)
					: new TradeHistoryPageResponse(List.of(), null, empty.page(), empty.totalPages(), empty.total());
		}

		List<TradeHistory> page;
		PageKeys<Object[]> pageKeys = null;
		boolean hasMore;
		if (pageNo == null) {
			String from = hasCursor ? cursor : null;
			List<TradeHistory> rows = histories.findPage(me, buy, sell, f.from(), f.to(), f.min(), f.max(), useProds, prodIds,
					from == null ? null : from.substring(0, 14), from == null ? null : from.substring(14), PageRequest.of(0, PAGE_SIZE + 1));
			hasMore = rows.size() > PAGE_SIZE;
			page = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
		} else {
			// 페이지 번호: 같은 조건의 키를 정렬 순서대로 전부 읽어 그 페이지의 키 20개를 잘라 읽는다 (offset 아님 — 키는 이미 다 읽었다)
			List<Object[]> keys = histories.findKeys(me, buy, sell, f.from(), f.to(), f.min(), f.max(), useProds, prodIds, sortOf(f.sort()));
			pageKeys = PageKeys.of(keys, pageNo, PAGE_SIZE);
			List<Object[]> slice = keys.subList((pageNo - 1) * PAGE_SIZE, Math.min(pageNo * PAGE_SIZE, keys.size()));
			Map<TradeHistoryId, TradeHistory> byId = histories
				.findAllById(slice.stream().map(k -> new TradeHistoryId((UUID) k[2], (String) k[1], (String) k[0])).toList()).stream()
				.collect(Collectors.toMap(TradeHistory::getId, h -> h));
			page = slice.stream().map(k -> byId.get(new TradeHistoryId((UUID) k[2], (String) k[1], (String) k[0]))).filter(Objects::nonNull).toList();
			hasMore = (long) pageNo * PAGE_SIZE < pageKeys.total();
		}

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
		// 커서는 최신순 전용 — 다른 정렬의 다음 장은 page 로만 간다
		String nextCursor = hasMore && "latest".equals(f.sort()) ? last.getTradeDate() + last.getTradeId() : null;
		return pageKeys == null ? new TradeHistoryPageResponse(items, nextCursor, null, null, null)
				: new TradeHistoryPageResponse(items, nextCursor, pageKeys.page(), pageKeys.totalPages(), pageKeys.total());
	}

	/** 같은 값이 여럿이면 확정일시·거래ID 로 끝을 맞춘다 (오래된 순은 그 정확한 반대). 금액이 없는 줄은 맨 뒤 */
	private static Sort sortOf(String sort) {
		return switch (sort) {
			case "oldest" -> Sort.by(Sort.Order.asc("tradeDate"), Sort.Order.asc("tradeId"));
			case "amountDesc" -> Sort.by(Sort.Order.desc("tradeAmount").nullsLast(), Sort.Order.desc("tradeDate"), Sort.Order.desc("tradeId"));
			case "amountAsc" -> Sort.by(Sort.Order.asc("tradeAmount").nullsLast(), Sort.Order.desc("tradeDate"), Sort.Order.desc("tradeId"));
			default -> Sort.by(Sort.Order.desc("tradeDate"), Sort.Order.desc("tradeId"));
		};
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
