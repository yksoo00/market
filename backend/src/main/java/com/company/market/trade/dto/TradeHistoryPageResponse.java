package com.company.market.trade.dto;

import java.util.List;

/** 내 거래이력 한 페이지. nextCursor = 마지막 항목의 확정일시 + 거래ID (없으면 끝). page·totalPages·total 은 요청에 page 가 있을 때만 */
public record TradeHistoryPageResponse(List<TradeHistoryItemResponse> items, String nextCursor, Integer page, Integer totalPages,
		Long total) {
}
