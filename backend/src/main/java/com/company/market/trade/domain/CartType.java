package com.company.market.trade.domain;

import jakarta.persistence.Converter;

/** 바구니 구분(trd_cart_info.cart_type). 정의서 설명의 "방바구니/비교용바구니"는 오타라 DB 에는 장바구니·비교용으로 저장한다 */
public enum CartType implements TradeCode {

	CART("장바구니"),
	COMPARE("비교용");

	private final String label;

	CartType(String label) {
		this.label = label;
	}

	@Override
	public String label() {
		return label;
	}

	@Converter
	public static class DbConverter extends TradeCodeConverter<CartType> {

		public DbConverter() {
			super(CartType.class);
		}

	}

}
