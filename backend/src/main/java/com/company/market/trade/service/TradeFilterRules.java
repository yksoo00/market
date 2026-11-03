package com.company.market.trade.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import com.company.market.common.exception.ValidationException;
import com.company.market.trade.dto.TradeFilter;

/**
 * 거래이력·활동내역 목록의 검색·필터 검증 (계획 2026-10-30). 수치는 docs/security.md "입력 검증" — 한 곳에 둬서 두 목록이
 * 같은 값·같은 오류 문구를 쓴다. 필터 값은 null 대신 "걸지 않는 값"으로 풀어 JPQL 에 넘긴다(Postgres 의 null 파라미터 타입 추론 실패 회피)
 */
final class TradeFilterRules {

	/** 기간·금액의 걸지 않는 값 */
	static final String DATE_MIN = "00000000000000";

	static final String DATE_MAX = "99999999999999";

	static final int Q_MAX = 100;

	static final List<String> FIELDS = List.of("all", "name", "brand");

	/**
	 * 정렬 값: latest(기본)·oldest(오래된 순) + 열마다 열이름Asc|Desc (열 머리 정렬 2026-11-03). 거래이력이 쓰는 열: name·party(상대)·side(구분)·
	 * unitPrice·quantity·amount. 활동내역 쪽 열(납품희망일·상태 등)은 그 목록 단계에서 더한다
	 */
	/** 활동내역 요청·구매 목록이 받는 정렬 — 열: name·party(상대)·quantity·unitPrice·amount·reqDeli(납품희망일)·status. 거래이력 전용 값(side)을 조용히 최신순으로 받지 않게 따로 둔다 */
	static final List<String> ACTIVITY_SORTS = List.of("latest", "oldest", "amountDesc", "amountAsc", "nameAsc", "nameDesc", "partyAsc", "partyDesc",
			"quantityAsc", "quantityDesc", "unitPriceAsc", "unitPriceDesc", "reqDeliAsc", "reqDeliDesc", "statusAsc", "statusDesc");

	static final List<String> SORTS = List.of("latest", "oldest", "amountDesc", "amountAsc", "nameAsc", "nameDesc", "partyAsc", "partyDesc",
			"sideAsc", "sideDesc", "unitPriceAsc", "unitPriceDesc", "quantityAsc", "quantityDesc");

	private static final Pattern ISO_DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");

	private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

	private TradeFilterRules() {
	}

	/** 검증을 통과한 필터. from·to 는 14자리(yyyyMMddHHmmss) 경계, q 가 없으면 상품 조건은 안 건다 */
	record Parsed(String q, String field, String from, String to, int min, int max, String sort) {
	}

	/** 거래이력 필터 검증 — 틀린 칸을 한 번에 모아 400. paged = page 파라미터가 있나 (최신순 아닌 정렬은 page 가 있어야 한다) */
	static Parsed parse(TradeFilter filter, boolean paged) {
		TradeFilter in = filter == null ? TradeFilter.none() : filter;
		Map<String, String> errors = new LinkedHashMap<>();
		Parsed parsed = parse(in, paged, errors, SORTS);
		if (!errors.isEmpty()) {
			throw new ValidationException(errors);
		}
		return parsed;
	}

	/** 다른 칸(상태 등)의 오류와 같이 모으려고 errors 를 받는 형태. sorts = 이 목록이 받는 정렬 값. 오류가 있으면 반환값은 쓰지 않는다 */
	static Parsed parse(TradeFilter in, boolean paged, Map<String, String> errors, List<String> sorts) {
		String q = in.q() == null || in.q().isBlank() ? null : in.q().trim();
		if (q != null && q.length() > Q_MAX) {
			errors.put("q", "검색어는 " + Q_MAX + "자 이하로 입력하세요.");
		}
		// 검색 구분 — 매물 검색과 같은 범위 (2026-10-30)
		String field = in.field() == null || in.field().isBlank() ? "all" : in.field();
		if (!FIELDS.contains(field)) {
			errors.put("field", "field 는 all, name, brand 중 하나여야 합니다.");
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
		if (!sorts.contains(sort)) {
			errors.put("sort", "sort 는 " + String.join(", ", sorts) + " 중 하나여야 합니다.");
		} else if (!paged && !"latest".equals(sort)) {
			errors.put("sort", "최신순 말고 다른 정렬은 page 와 함께 써야 합니다.");
		}

		return new Parsed(q, field, from == null ? DATE_MIN : from.format(DAY) + "000000", to == null ? DATE_MAX : to.format(DAY) + "235959",
				min == null ? 0 : min.intValue(), max == null ? Integer.MAX_VALUE : max.intValue(), sort);
	}

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

}
