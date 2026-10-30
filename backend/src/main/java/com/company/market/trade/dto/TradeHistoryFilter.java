package com.company.market.trade.dto;

/**
 * 내 거래이력 검색·필터의 날것 요청 값 (계획 2026-10-30). 전부 선택. 검증은 TradeActivityService 가 한다 — 금액은
 * int 범위를 넘는 값도 400(필드 오류)으로 돌려주려고 Long 으로 받는다
 */
public record TradeHistoryFilter(String q, String from, String to, Long minAmount, Long maxAmount, String sort) {

	public static TradeHistoryFilter none() {
		return new TradeHistoryFilter(null, null, null, null, null, null);
	}

}
