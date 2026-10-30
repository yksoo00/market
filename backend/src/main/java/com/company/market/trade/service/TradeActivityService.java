package com.company.market.trade.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
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
import com.company.market.trade.dto.TradeHistoryFilter;
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

	/** 내 거래이력 필터 중 걸지 않는 값 (JPQL 에 null 을 넘기지 않으려고) */
	private static final String DATE_MIN = "00000000000000";

	private static final String DATE_MAX = "99999999999999";

	/** 상품명 검색으로 한 번에 거는 상품 수 상한. IN 조건이 끝없이 길어지지 않게 (PURCHASED_KEYS_MAX 와 같은 이유) */
	static final int NAME_MATCH_MAX = 500;

	static final int Q_MAX = 100;

	private static final List<String> SORTS = List.of("latest", "oldest", "amountDesc", "amountAsc");

	private static final Pattern ISO_DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");

	/** 검증을 통과한 필터. q 가 없으면 prodIds 는 쓰이지 않는다 */
	private record Parsed(String q, String from, String to, int min, int max, String sort) {
	}

	/**
	 * side = all | buy | sell. 최신 확정순 20줄 + 커서(확정일시 14자 + 거래ID). 필터(상품명·기간·금액·정렬, 계획 2026-10-30)는
	 * 전부 본인 이력 조건 안에서만 걸린다. 정렬이 최신순이 아니면 page 가 필요하다 (커서는 최신순 전용)
	 */
	public TradeHistoryPageResponse history(UUID me, String side, String cursor, Integer pageNo, TradeHistoryFilter filter) {
		if (!Set.of("all", "buy", "sell").contains(side == null ? "all" : side)) {
			throw new ValidationException(Map.of("side", "side 는 all, buy, sell 중 하나여야 합니다."));
		}
		if (cursor != null && !cursor.isEmpty() && !cursor.matches("\\d{25}")) {
			throw new ValidationException(Map.of("cursor", "커서 형식이 올바르지 않습니다."));
		}
		Parsed f = parse(filter, pageNo != null);
		boolean hasCursor = cursor != null && !cursor.isEmpty();
		boolean buy = !"sell".equals(side);
		boolean sell = !"buy".equals(side);
		boolean useProds = f.q() != null;
		List<String> prodIds = useProds ? listings.productIdsByName(f.q(), NAME_MATCH_MAX) : List.of("");
		if (useProds && prodIds.isEmpty()) {
			// 맞는 상품이 없으면 쿼리 없이 빈 결과. 페이지 번호면 1페이지만 있다
			PageKeys<Object[]> empty = pageNo == null ? null : PageKeys.of(List.of(), pageNo, PAGE_SIZE);
			return empty == null ? new TradeHistoryPageResponse(List.of(), null, null, null, null)
					: new TradeHistoryPageResponse(List.of(), null, empty.page(), empty.totalPages(), empty.total());
		}
		if (prodIds.isEmpty()) {
			prodIds = List.of("");
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

	/** 필터 검증 — 틀린 칸을 한 번에 모아 400. 수치는 docs/security.md "입력 검증" 거래이력 */
	private static Parsed parse(TradeHistoryFilter filter, boolean paged) {
		TradeHistoryFilter in = filter == null ? TradeHistoryFilter.none() : filter;
		Map<String, String> errors = new LinkedHashMap<>();

		String q = in.q() == null || in.q().isBlank() ? null : in.q().trim();
		if (q != null && q.length() > Q_MAX) {
			errors.put("q", "검색어는 " + Q_MAX + "자 이하로 입력하세요.");
		}

		LocalDate from = parseDate(in.from(), "from", errors);
		LocalDate to = parseDate(in.to(), "to", errors);
		if (from != null && to != null && from.isAfter(to)) {
			errors.put("from", "시작일은 종료일보다 늦을 수 없습니다.");
		}

		Long min = in.minAmount();
		Long max = in.maxAmount();
		if (min != null && (min < 0 || min > Integer.MAX_VALUE)) {
			errors.put("minAmount", "금액은 0원 이상 2,147,483,647원 이하로 입력하세요.");
		}
		if (max != null && (max < 0 || max > Integer.MAX_VALUE)) {
			errors.put("maxAmount", "금액은 0원 이상 2,147,483,647원 이하로 입력하세요.");
		}
		if (!errors.containsKey("minAmount") && !errors.containsKey("maxAmount") && min != null && max != null && min > max) {
			errors.put("minAmount", "최소 금액은 최대 금액보다 클 수 없습니다.");
		}

		String sort = in.sort() == null || in.sort().isBlank() ? "latest" : in.sort();
		if (!SORTS.contains(sort)) {
			errors.put("sort", "sort 는 latest, oldest, amountDesc, amountAsc 중 하나여야 합니다.");
		} else if (!paged && !"latest".equals(sort)) {
			errors.put("sort", "최신순 말고 다른 정렬은 page 와 함께 써야 합니다.");
		}

		if (!errors.isEmpty()) {
			throw new ValidationException(errors);
		}
		return new Parsed(q, from == null ? DATE_MIN : from.format(DAY) + "000000", to == null ? DATE_MAX : to.format(DAY) + "235959",
				min == null ? 0 : min.intValue(), max == null ? Integer.MAX_VALUE : max.intValue(), sort);
	}

	private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

	private static LocalDate parseDate(String value, String field, Map<String, String> errors) {
		if (value == null || value.isBlank()) {
			return null;
		}
		if (!ISO_DATE.matcher(value).matches()) {
			errors.put(field, "날짜는 yyyy-MM-dd 형식으로 입력하세요.");
			return null;
		}
		try {
			return LocalDate.parse(value);
		} catch (DateTimeParseException e) {
			errors.put(field, "존재하지 않는 날짜입니다.");
			return null;
		}
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
