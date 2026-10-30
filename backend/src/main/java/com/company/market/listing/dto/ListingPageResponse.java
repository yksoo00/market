package com.company.market.listing.dto;

import java.util.List;

/**
 * total 은 같은 조건의 전체 개수(커서와 무관) — 화면 "검색결과 N건".
 * page·totalPages 는 요청에 page 가 있을 때만 (페이지 번호 방식, 설계 2026-10-27 PR 5), 커서 방식이면 null
 */
public record ListingPageResponse(List<ListingSearchItemResponse> items, String nextCursor, long total, Integer page,
		Integer totalPages) {
}
