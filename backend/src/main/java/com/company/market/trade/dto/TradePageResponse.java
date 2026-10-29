package com.company.market.trade.dto;

import java.util.List;

/**
 * 거래 목록 한 페이지. nextCursor = 마지막 항목의 tradeId (없으면 끝).
 * page·totalPages·total 은 요청에 page 가 있을 때만 (페이지 번호 방식, 설계 2026-10-27 PR 5), 커서 방식이면 null
 */
public record TradePageResponse(List<TradeResponse> items, String nextCursor, Integer page, Integer totalPages, Long total) {
}
