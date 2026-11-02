package com.company.market.trade.dto;

/** 바꾼 뒤 그 줄의 담은 수량 */
public record CartQuantityResponse(String tradeId, int orderQuantity) {
}
