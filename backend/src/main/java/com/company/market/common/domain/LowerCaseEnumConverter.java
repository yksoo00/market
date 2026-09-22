package com.company.market.common.domain;

import java.util.Locale;

import jakarta.persistence.AttributeConverter;

/**
 * Java enum(대문자) ↔ DB text(소문자, check 제약). 열거형 컬럼마다 이 클래스를 상속한 컨버터 하나.
 * `@Enumerated(STRING)` 을 안 쓰는 이유: DB 값이 소문자라 data-model.md·프론트 문자열과 그대로 맞추기 위해.
 */
public abstract class LowerCaseEnumConverter<E extends Enum<E>> implements AttributeConverter<E, String> {

	private final Class<E> type;

	protected LowerCaseEnumConverter(Class<E> type) {
		this.type = type;
	}

	@Override
	public String convertToDatabaseColumn(E value) {
		return value == null ? null : value.name().toLowerCase(Locale.ROOT);
	}

	@Override
	public E convertToEntityAttribute(String stored) {
		return stored == null ? null : Enum.valueOf(type, stored.toUpperCase(Locale.ROOT));
	}

}
