package com.company.market.listing.dto;

import java.util.List;

/** total 은 같은 조건의 전체 개수(커서와 무관) — 화면 "검색결과 N건" */
public record ListingPageResponse(List<ListingSearchItemResponse> items, String nextCursor, long total) {
}
