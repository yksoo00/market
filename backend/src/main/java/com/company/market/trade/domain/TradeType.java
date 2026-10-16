package com.company.market.trade.domain;

import jakarta.persistence.Converter;

/** 거래종류(trade_type). 직접 구매만 — 견적(조정요청·회신·비교)은 아직 없다. DB 는 한글 라벨 (TradeStats 와 같은 이유) */
public enum TradeType implements TradeCode {

	PURCHASE_REQUEST("구매요청"),
	PURCHASE_CONFIRM("구매확정"),
	PURCHASE_CANCEL("구매취소");

	private final String label;

	TradeType(String label) {
		this.label = label;
	}

	@Override
	public String label() {
		return label;
	}

	@Converter
	public static class DbConverter extends TradeCodeConverter<TradeType> {

		public DbConverter() {
			super(TradeType.class);
		}

	}

}
