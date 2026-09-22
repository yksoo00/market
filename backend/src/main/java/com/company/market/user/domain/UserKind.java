package com.company.market.user.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

/** 일반(아이디·소셜) / 기업 담당자. DB 값은 소문자 (users.kind check) */
public enum UserKind {
	PERSONAL, BUSINESS;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<UserKind> {

		public Db() {
			super(UserKind.class);
		}

	}
}
