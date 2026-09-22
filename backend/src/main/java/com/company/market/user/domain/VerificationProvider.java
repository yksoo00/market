package com.company.market.user.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

/** STUB 은 개발용. 운영에서는 거부 */
public enum VerificationProvider {
	PASS, NICE, STUB;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<VerificationProvider> {

		public Db() {
			super(VerificationProvider.class);
		}

	}
}
