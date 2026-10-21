package com.company.market.trade.domain;

import jakarta.persistence.Converter;

/**
 * 거래종류(trade_type) = 무슨 기록인가. 만들 때 정하고 바뀌지 않는다 (정의서 값, 사용자 결정 2026-10-20).
 * 진행은 TradeStats 가 맡는다. 정의서 값 "요청중"은 쓰지 않는다. DB 는 한글 라벨, API 는 code.
 */
public enum TradeType implements TradeCode {

	/** 장바구니(비교용은 아직 안 씀). 구매자 거래 목록·판매자 화면에 안 나온다 */
	REVIEW("구매검토", "review"),
	QUOTE("견적조정", "quote"),
	PURCHASE("거래", "purchase");

	private final String label;

	private final String code;

	TradeType(String label, String code) {
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
	public static class DbConverter extends TradeCodeConverter<TradeType> {

		public DbConverter() {
			super(TradeType.class);
		}

	}

}
