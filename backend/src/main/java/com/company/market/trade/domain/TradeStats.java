package com.company.market.trade.domain;

import jakarta.persistence.Converter;

/** 거래상태(trade_stats). DB 에는 정의서의 한글 라벨로 저장한다 — 숫자 코드로 바뀌면 라벨만 고친다 (사용자 지시 2026-10-15) */
public enum TradeStats implements TradeCode {

	REQUESTED("구매요청"),
	CONFIRMED("구매확정"),
	CANCELED("취소");

	private final String label;

	TradeStats(String label) {
		this.label = label;
	}

	@Override
	public String label() {
		return label;
	}

	@Converter
	public static class DbConverter extends TradeCodeConverter<TradeStats> {

		public DbConverter() {
			super(TradeStats.class);
		}

	}

}
