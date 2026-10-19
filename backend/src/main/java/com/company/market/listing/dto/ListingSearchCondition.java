package com.company.market.listing.dto;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * GET /api/v1/listings 쿼리 파라미터. 의미는 docs/superpowers/specs/2026-10-02-search-api-design.md,
 * 수치는 docs/security.md "입력 검증"(프론트 lib/search.ts 와 같은 값).
 */
public record ListingSearchCondition(
		@Size(max = 100) String q,
		@Pattern(regexp = "all|name|brand") String field,
		@Pattern(regexp = "available|completed|all") String status,
		@Min(0) @Max(100_000) Integer minStock,
		@Min(0) @Max(1_000_000_000) Integer minPrice,
		@Min(0) @Max(1_000_000_000) Integer maxPrice,
		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deliveryBy,
		// 상세 필터 (2026-10-19). 카테고리는 대·중·소 코드 — 고른 분류와 그 아래 전부. 글자 제한이라 LIKE 와일드카드가 들어올 수 없다
		@Size(max = 12) @Pattern(regexp = "[A-Z0-9]{1,4}(-[A-Z0-9]{1,4}){0,2}") String category,
		// 상품상태 "이 구간 이상": new=신품, 90=신품대비 90~99% … (ListingSearchRepository.STATES)
		@Pattern(regexp = "new|90|80|70|60|50") String state,
		@Size(max = 50) String brand,
		// 보증기한(일) 이상. 등록 값은 0·30·90·180·360·720·1080 (ListingService.WARRANTY_DAYS)
		@Min(0) @Max(1080) Integer minWarranty,
		// 불량지원: replace=대체, refund=환불 (URL 에 한글을 싣지 않게 영문 키)
		@Pattern(regexp = "replace|refund") String coverage,
		// 가진 자료(쉼표로 여러 개, 전부 가진 매물만): datasheet·photo·testReport·certificate·replaceProd
		@Pattern(regexp = HAS_PATTERN) String has,
		// 최소주문수량이 N 이하 = N개만 사도 살 수 있는 매물
		@Min(1) @Max(100_000) Integer maxMinOrder,
		// true 면 요청자 본인 글만. 로그인 필수 — 본인 id 는 이 값이 아니라 인증 정보에서만 가져온다 (컨트롤러)
		Boolean mine,
		String cursor) {

	private static final String HAS_ITEM = "(datasheet|photo|testReport|certificate|replaceProd)";

	public static final String HAS_PATTERN = HAS_ITEM + "(," + HAS_ITEM + "){0,4}";

	public ListingSearchCondition {
		// 100자 제한은 앞뒤 공백을 뺀 길이 — 검증은 생성된 값에 걸린다
		q = q == null ? null : q.trim();
		// 빈 값(?field=)도 생략과 같게 — 숫자·날짜 파라미터는 빈 값이 null 로 바인딩되는 것과 맞춘다
		field = field == null || field.isBlank() ? "all" : field;
		// 기존 목록 호출(파라미터 없음)이 계속 전체를 돌려주게. 화면은 항상 보낸다
		status = status == null || status.isBlank() ? "all" : status;
		category = blankToNull(category);
		state = blankToNull(state);
		brand = brand == null || brand.isBlank() ? null : brand.trim();
		coverage = blankToNull(coverage);
		has = blankToNull(has);
	}

	/** has 를 낱개로. 같은 값이 두 번 와도 조건은 한 번 */
	public Set<String> hasItems() {
		return has == null ? Set.of() : Arrays.stream(has.split(",")).collect(Collectors.toSet());
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value;
	}

	public boolean mineOnly() {
		return Boolean.TRUE.equals(mine);
	}

}
