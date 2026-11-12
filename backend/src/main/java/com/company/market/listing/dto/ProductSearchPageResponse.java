package com.company.market.listing.dto;

import java.util.List;

/** 상품마스터 검색 한 페이지. 목록 페이지 번호 방식(backend.md "API")의 { items, page, totalPages, total } */
public record ProductSearchPageResponse(List<ProductPageItemResponse> items, int page, int totalPages, long total) {
}
