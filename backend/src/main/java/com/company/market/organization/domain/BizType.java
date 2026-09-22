package com.company.market.organization.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

/** 법인 / 개인사업자 */
public enum BizType {
	CORPORATION, INDIVIDUAL;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<BizType> {

		public Db() {
			super(BizType.class);
		}

	}
}
