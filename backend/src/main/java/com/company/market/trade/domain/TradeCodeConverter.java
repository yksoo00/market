package com.company.market.trade.domain;

import jakarta.persistence.AttributeConverter;

/**
 * 거래 코드 enum ↔ DB 라벨. 지금은 정의서의 한글 이름(구매요청 등)을 그대로 저장하고, 공통코드 테이블이 생기면
 * 숫자 코드로 바꾼다 (사용자 지시 2026-10-15). 그때 이 변환과 enum 라벨만 고치면 된다.
 */
public abstract class TradeCodeConverter<E extends Enum<E> & TradeCode> implements AttributeConverter<E, String> {

	private final Class<E> type;

	protected TradeCodeConverter(Class<E> type) {
		this.type = type;
	}

	@Override
	public String convertToDatabaseColumn(E value) {
		return value == null ? null : value.label();
	}

	@Override
	public E convertToEntityAttribute(String stored) {
		if (stored == null) {
			return null;
		}
		for (E e : type.getEnumConstants()) {
			if (e.label().equals(stored)) {
				return e;
			}
		}
		throw new IllegalStateException("알 수 없는 " + type.getSimpleName() + " 값: " + stored);
	}

}
