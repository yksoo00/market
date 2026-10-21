package com.company.market.trade.dto;

import com.company.market.listing.dto.ListingSearchItemResponse;

/** 장바구니 한 줄 = 빼기에 쓸 tradeId + 지금 매물 값(검색 결과와 같은 칸 — 프론트가 같은 표를 쓴다) */
public record CartItemResponse(String tradeId, ListingSearchItemResponse listing) {
}
