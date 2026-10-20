package com.company.market.trade.domain;

import jakarta.persistence.Converter;

/**
 * 거래상태(trade_stats) = 지금 어디까지 왔나. 앞으로만 바뀐다 (사용자 결정 2026-10-20).
 * 견적조정: 견적요청 → 견적회신(수락·거절 둘 다 — 결과는 메일로만). 거래: 구매요청 → 구매확정.
 * 취소는 값 없이 행을 지운다. DB 에는 정의서의 한글 라벨로 저장한다 — 숫자 코드로 바뀌면 라벨만 고친다.
 */
public enum TradeStats implements TradeCode {

	CART("장바구니", "cart"),
	COMPARE("비교용", "compare"),
	QUOTE_REQUESTED("견적요청", "quoteRequested"),
	/** 정의서 밖 값 (사용자 결정 2026-10-20) */
	QUOTE_REPLIED("견적회신", "quoteReplied"),
	REQUESTED("구매요청", "requested"),
	CONFIRMED("구매확정", "confirmed");

	private final String label;

	private final String code;

	TradeStats(String label, String code) {
		this.label = label;
		this.code = code;
	}

	@Override
	public String label() {
		return label;
	}

	public String code() {
		return code;
	}

	@Converter
	public static class DbConverter extends TradeCodeConverter<TradeStats> {

		public DbConverter() {
			super(TradeStats.class);
		}

	}

}
