package com.company.market.trade.service;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
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
			List<Object[]> keys = new ArrayList<>(histories.findKeys(me, buy, sell, f.from(), f.to(), f.min(), f.max(), useProds, prodIds));
			keys.sort(keyOrder(f.sort(), me, keys));
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

	/**
	 * 거래이력 키의 정렬 (열 머리 정렬 2026-11-03). 키 = [확정일시, 거래ID, 구매자ID, 판매자ID, 상품ID, 수량, 단가, 금액].
	 * sort = latest | oldest | 열이름Asc|Desc(name·party·side·unitPrice·quantity·amount). 같은 값끼리는 최신(확정일시·거래ID 내림차순)으로 끝을 맞추고
	 * (오래된 순은 그 정확한 반대), 값이 비어 있는 줄(이름 모름·금액 없음)은 오름·내림 모두 맨 뒤. 상품명은 상품마스터에서, 상대는 화면에 보이는 별명으로
	 * 정렬한다 — 목록에 보이는 값과 같아야 해서 키를 전부 모은 뒤 한 번에 조회한다
	 */
	private Comparator<Object[]> keyOrder(String sort, UUID me, List<Object[]> keys) {
		Comparator<Object[]> oldest = Comparator.comparing((Object[] k) -> (String) k[0]).thenComparing(k -> (String) k[1]);
		Comparator<Object[]> latest = oldest.reversed();
		if ("oldest".equals(sort)) {
			return oldest;
		}
		boolean desc = sort.endsWith("Desc");
		String column = sort.replaceFirst("(Asc|Desc)$", "");
		Collator collator = Collator.getInstance(Locale.KOREAN);
		Comparator<Object[]> by = switch (column) {
			case "name" -> {
				Map<String, String> names = listings.productNames(keys.stream().map(k -> (String) k[4]).collect(Collectors.toSet()));
				yield columnOrder(k -> names.get((String) k[4]), (a, b) -> collator.compare(a, b), desc);
			}
			case "party" -> {
				Map<UUID, String> nicknames = userDirectory.nicknamesOf(keys.stream().map(k -> counterpartOf(me, k)).collect(Collectors.toSet()));
				yield columnOrder(k -> nicknames.get(counterpartOf(me, k)), (a, b) -> collator.compare(a, b), desc);
			}
			// 구분: 내가 구매자면 구매, 아니면 판매. 오름 = 구매 먼저
			case "side" -> columnOrder(k -> me.equals(k[2]) ? 0 : 1, Integer::compare, desc);
			case "quantity" -> columnOrder(k -> (Number) k[5], (a, b) -> Long.compare(a.longValue(), b.longValue()), desc);
			case "unitPrice" -> columnOrder(k -> (Number) k[6], (a, b) -> Long.compare(a.longValue(), b.longValue()), desc);
			case "amount" -> columnOrder(k -> (Number) k[7], (a, b) -> Long.compare(a.longValue(), b.longValue()), desc);
			default -> null;
		};
		return by == null ? latest : by.thenComparing(latest);
	}

	/** 구매자면 판매자가, 판매자면 구매자가 상대 */
	private static UUID counterpartOf(UUID me, Object[] key) {
		return me.equals(key[2]) ? (UUID) key[3] : (UUID) key[2];
	}

	/** 열 하나의 순서. 값이 비어 있으면 오름·내림 모두 맨 뒤로 */
	private static <T> Comparator<Object[]> columnOrder(Function<Object[], T> value, Comparator<T> order, boolean desc) {
		return (a, b) -> {
			T x = value.apply(a);
			T y = value.apply(b);
			if (x == null || y == null) {
				return x == null ? (y == null ? 0 : 1) : -1;
			}
			int c = order.compare(x, y);
			return desc ? -c : c;
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
