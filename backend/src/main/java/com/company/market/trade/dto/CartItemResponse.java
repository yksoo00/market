package com.company.market.trade.dto;

import com.company.market.listing.dto.ListingSearchItemResponse;

/**
 * 장바구니·비교 한 줄 = 빼기에 쓸 tradeId + 담을 때 입력(구매·견적 모달의 기본값) + 지금 매물 값(검색 결과와 같은 칸 — 프론트가 같은 표를 쓴다).
 * 비교 행은 입력 칸이 기본값(수량 = 최소주문량, 납품희망일 = 제공가능일)이다. addedAt = 담은 시각(yyyyMMddHHmmss, UTC) — 장바구니는 1시간 뒤 자동으로 빠진다
 */
public record CartItemResponse(String tradeId, int orderQuantity, String reqDeliDate, String remarks, String addedAt,
		ListingSearchItemResponse listing) {
}
