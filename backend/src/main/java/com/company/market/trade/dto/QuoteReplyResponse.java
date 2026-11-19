package com.company.market.trade.dto;

import java.util.List;

/**
 * 건별 결과 — 한 건이 틀려도 전체가 실패하지 않는다. 성공이면 tradeStats(quoteAccepted|quoteRejected), 실패면 code·message
 * (같은 매물 묶음에서 합계가 재고를 넘으면 그 묶음 전부 같은 사유)
 */
public record QuoteReplyResponse(List<Result> results) {

	public record Result(String tradeId, boolean ok, String tradeStats, String code, String message) {
	}

}
