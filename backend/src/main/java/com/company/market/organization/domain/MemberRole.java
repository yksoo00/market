package com.company.market.organization.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

/** 1단계는 OWNER 1명. MEMBER 는 2단계(사용자 초대) */
public enum MemberRole {
	OWNER, MEMBER;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<MemberRole> {

		public Db() {
			super(MemberRole.class);
		}

	}
}
