package com.company.market.trade.dto;

import java.util.List;

/** 거래 목록 한 페이지. nextCursor = 마지막 항목의 tradeId (없으면 끝) */
public record TradePageResponse(List<TradeResponse> items, String nextCursor) {
}
