package com.company.market.user.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

/** suspended=이용 정지(관리자), withdrawn=탈퇴(deleted_at 과 같이) */
public enum UserStatus {
	ACTIVE, SUSPENDED, WITHDRAWN;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<UserStatus> {

		public Db() {
			super(UserStatus.class);
		}

	}
}
