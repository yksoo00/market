package com.company.market.trade.dto;

/** 검색 범위 탭을 보일지: sales = 내 매물이 있음, purchases = 구매 거래나 거래이력이 있음 */
public record TradeScopesResponse(boolean sales, boolean purchases) {
}
