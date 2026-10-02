package com.company.market.listing.dto;

import java.time.LocalDate;

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
		String cursor) {

	public ListingSearchCondition {
		// 100자 제한은 앞뒤 공백을 뺀 길이 — 검증은 생성된 값에 걸린다
		q = q == null ? null : q.trim();
		field = field == null ? "all" : field;
		// 기존 목록 호출(파라미터 없음)이 계속 전체를 돌려주게. 화면은 항상 보낸다
		status = status == null ? "all" : status;
	}

}
