package com.company.market.user.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

public enum UserRole {
	USER, ADMIN;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<UserRole> {

		public Db() {
			super(UserRole.class);
		}

	}
}
