package com.company.market.listing.dto;

import java.time.LocalDate;

/** GET /api/v1/listings 쿼리 파라미터. 의미는 docs/superpowers/specs/2026-10-02-search-api-design.md */
public record ListingSearchCondition(
		String q,
		String field,
		String status,
		Integer minStock,
		Integer minPrice,
		Integer maxPrice,
		LocalDate deliveryBy,
		String cursor) {

	public ListingSearchCondition {
		field = field == null ? "all" : field;
		// 기존 목록 호출(파라미터 없음)이 계속 전체를 돌려주게. 화면은 항상 보낸다
		status = status == null ? "all" : status;
	}

}
