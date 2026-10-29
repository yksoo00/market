package com.company.market.trade.dto;

/**
 * 내 거래이력 한 줄. side = buy(내가 구매자) | sell(내가 판매자). 상대는 닉네임만 (개인정보 없음).
 * tradeDate 는 확정일시 14자 yyyyMMddHHmmss
 */
public record TradeHistoryItemResponse(String tradeId, String tradeDate, String side, String prodName, String counterpartNickname,
		Integer unitPrice, Integer quantity, Integer amount) {
}
