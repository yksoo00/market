package com.company.market.trade.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.company.market.common.time.KoreanDates;
import com.company.market.listing.dto.ListingTraits;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ProdStates;
import com.company.market.trade.dto.CartBulkRowDto;
import com.company.market.trade.dto.CartBulkRowResult.ListingOption;
import org.springframework.stereotype.Component;

/**
 * 엑셀 대량구매 줄의 조건 판정과 기본 매물 정렬 (계획 2026-11-09-bulk-purchase-conditions.md). 조건은 매물을 **거르는** 것이고(안 맞으면 못 사는 사유가
 * 붙는다), 거른 뒤 하나를 고르는 건 정렬이다. 줄에 쓴 조건은 전부 선택 — 비우면 조건 없음.
 * 제공가능일 규칙은 줄 조건이 아니라 늘 걸린다: 매물 제공가능일이 납품희망일보다 늦으면 못 산다(날짜가 아닌 레거시 글은 비교할 수 없어 통과). 장바구니·구매 화면에는 없는 대량구매 전용 규칙이다
 */
@Component
class CartBulkConditions {

	/** 최소 보증 개월 → 보증기한(일). 매물의 보증기한 선택지(30·90·180·360·720·1080일)와 같은 값 */
	static final Map<Integer, Integer> WARRANTY_DAYS_BY_MONTHS = Map.of(1, 30, 3, 90, 6, 180, 12, 360, 24, 720, 36, 1080);

	/** 단가 상한의 범위 — 매물 등록단가의 최대(10억)와 같다 */
	static final int MAX_PRICE = 1_000_000_000;

	private static final String ERR_STATE = "상태는 목록에서 골라 주세요.";

	private static final String ERR_PRICE = "단가 상한은 1 이상 1,000,000,000 이하 숫자로 입력해 주세요.";

	private static final String ERR_WARRANTY = "보증은 1·3·6·12·24·36개월 중에서 골라 주세요.";

	private static final String ERR_NEED = "Y 로 쓰거나 비워 두세요.";

	/** 상태 순위가 없는(목록 밖 레거시 글) 매물을 정렬에서 맨 뒤로 */
	private static final int UNKNOWN_RANK = 99;

	/** 줄에서 읽은 조건. 모두 null/false 면 조건 없음 */
	record Conditions(Integer minStateRank, String minStateLabel, Integer maxPrice, Integer minWarrantyMonths, boolean dataSheet, boolean photo,
			boolean coverage, boolean testReport, boolean certificate) {

		/**
		 * 이 매물이 조건과 다른 점 전부(없으면 빈 목록). 순서: 상태 → 단가 → 보증 → 제공가능일 → 증빙. **막는 게 아니라 알리는 것이다** —
		 * 사용자가 알고 고를 수 있다(담기가 실제로 거절하는 하드 막힘은 CartBulkService.reasonOf). 기본 매물은 다른 점이 없는 것 중에서만 고른다.
		 * 제공가능일은 줄 조건이 아니라 늘 보는 비교라서 reqDeliDate(납품희망일, 형식이 틀리면 건너뜀)와 같이 본다
		 */
		List<String> mismatches(ListingTradeSnapshot s, ListingTraits t, String reqDeliDate) {
			List<String> out = new ArrayList<>();
			if (minStateRank != null) {
				int rank = ProdStates.rank(t.prodState());
				if (rank < 0) {
					out.add("상품상태를 알 수 없어 조건(%s 이상)을 확인할 수 없어요.".formatted(minStateLabel));
				}
				else if (rank > minStateRank) {
					out.add("상태(%s)가 조건(%s 이상)보다 낮아요.".formatted(t.prodState(), minStateLabel));
				}
			}
			if (maxPrice != null && s.salesUnitPrice() != null && s.salesUnitPrice() > maxPrice) {
				out.add("단가(%,d원)가 상한(%,d원)을 넘어요.".formatted(s.salesUnitPrice(), maxPrice));
			}
			if (minWarrantyMonths != null) {
				int need = WARRANTY_DAYS_BY_MONTHS.get(minWarrantyMonths);
				if (t.warrantyDays() == null || t.warrantyDays() < need) {
					out.add("보증기한이 조건(%d개월 이상)에 못 미쳐요.".formatted(minWarrantyMonths));
				}
			}
			LocalDate request = KoreanDates.parseIso(reqDeliDate);
			LocalDate provide = KoreanDates.parseIso(s.provDate());
			if (request != null && provide != null && provide.isAfter(request)) {
				out.add("제공가능일(%s)이 납품희망일보다 늦어요.".formatted(s.provDate()));
			}
			if (dataSheet && !t.hasDataSheet()) {
				out.add("데이터시트가 없어요.");
			}
			if (photo && !t.hasPhoto()) {
				out.add("사진이 없어요.");
			}
			if (coverage && t.warrantyCoverage() == null) {
				out.add("불량지원방법이 없어요.");
			}
			if (testReport && !t.hasTestReport()) {
				out.add("테스트리포트가 없어요.");
			}
			if (certificate && !t.hasCertificate()) {
				out.add("정품인증서가 없어요.");
			}
			return out;
		}
	}

	/** 줄의 조건 칸을 읽는다. 틀린 칸은 그 칸 이름으로 fields 에 사유를 넣고 그 조건은 없는 것으로 둔다 */
	Conditions of(CartBulkRowDto row, Map<String, String> fields) {
		Integer minStateRank = null;
		String minStateLabel = null;
		String state = norm(row.minState());
		if (state != null) {
			int rank = ProdStates.rank(state);
			if (rank < 0) {
				fields.put("minState", ERR_STATE);
			}
			else {
				minStateRank = rank;
				minStateLabel = ProdStates.LABELS.get(rank);
			}
		}
		Integer maxPrice = number(row.maxPrice(), 1, MAX_PRICE, "maxPrice", ERR_PRICE, fields);
		Integer months = null;
		String rawMonths = norm(row.minWarrantyMonths());
		if (rawMonths != null) {
			String monthsText = rawMonths.replaceAll("\\s*개월$", "");
			// "개월"만 적은 칸을 조건 없음으로 넘기지 않는다
			if (monthsText.isBlank()) {
				fields.put("minWarrantyMonths", ERR_WARRANTY);
			}
			Integer parsed = number(monthsText, 1, 36, "minWarrantyMonths", ERR_WARRANTY, fields);
			if (parsed != null) {
				if (WARRANTY_DAYS_BY_MONTHS.containsKey(parsed)) {
					months = parsed;
				}
				else {
					fields.put("minWarrantyMonths", ERR_WARRANTY);
				}
			}
		}
		return new Conditions(minStateRank, minStateLabel, maxPrice, months, need(row.needDataSheet(), "needDataSheet", fields),
				need(row.needPhoto(), "needPhoto", fields), need(row.needCoverage(), "needCoverage", fields),
				need(row.needTestReport(), "needTestReport", fields), need(row.needCertificate(), "needCertificate", fields));
	}

	/**
	 * 매물 카드의 고정 순서: 단가 낮은 순 → 보증 긴 순(없는 매물은 뒤) → 상태 좋은 순(목록 밖은 뒤) → 제공가능일 빠른 순(비어 있으면 뒤) →
	 * 재고 많은 순 → 등록일시 빠른 순. 조건에 맞는 매물이 여럿일 때 맨 위 카드가 "추천"이다(미리 고르지는 않는다)
	 */
	Comparator<ListingOption> comparator() {
		Comparator<ListingOption> price = Comparator.comparingInt(ListingOption::unitPrice);
		Comparator<ListingOption> warranty = Comparator.comparingInt((ListingOption o) -> o.traits().warrantyDays() == null ? -1 : o.traits().warrantyDays()).reversed();
		Comparator<ListingOption> state = Comparator.comparingInt(o -> {
			int rank = ProdStates.rank(o.traits().prodState());
			return rank < 0 ? UNKNOWN_RANK : rank;
		});
		return price.thenComparing(warranty).thenComparing(state)
			.thenComparing(Comparator.comparing((ListingOption o) -> blankToNull(o.deliveryDate()), Comparator.nullsLast(Comparator.naturalOrder())))
			.thenComparing(Comparator.comparingInt(ListingOption::stock).reversed())
			.thenComparing(ListingOption::regDate);
	}

	/** 정수 칸. 비면 null(조건 없음), 쉼표는 허용, 숫자가 아니거나 범위 밖이면 사유를 fields 에 넣고 null */
	private static Integer number(String raw, int min, int max, String field, String error, Map<String, String> fields) {
		String text = norm(raw);
		if (text == null) {
			return null;
		}
		String digits = text.replace(",", "").replaceAll("\\s+", "");
		if (!digits.matches("\\d{1,10}")) {
			fields.put(field, error);
			return null;
		}
		long value = Long.parseLong(digits);
		if (value < min || value > max) {
			fields.put(field, error);
			return null;
		}
		return (int) value;
	}

	/** 증빙 칸: "Y"(대소문자 무시)만 필수, 비면 상관없음, 그 밖의 글은 오류 */
	private static boolean need(String raw, String field, Map<String, String> fields) {
		String text = norm(raw);
		if (text == null) {
			return false;
		}
		if (text.toUpperCase(Locale.ROOT).equals("Y")) {
			return true;
		}
		fields.put(field, ERR_NEED);
		return false;
	}

	/** 제공가능일 칸은 빈 글자로 저장될 수 있다 — 정렬에서 날짜가 있는 매물보다 앞서지 않게 */
	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s;
	}

	private static String norm(String s) {
		if (s == null) {
			return null;
		}
		String t = s.trim().replaceAll("\\s+", " ");
		return t.isEmpty() ? null : t;
	}

}
