package com.company.market.organization.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

/** 기업 가입 관리자 심사 (decisions.md 2026-09-21). approved 일 때만 사업자 배지·사업자 명의 매물 */
public enum ReviewStatus {
	PENDING, APPROVED, REJECTED;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<ReviewStatus> {

		public Db() {
			super(ReviewStatus.class);
		}

	}
}
