package com.company.market.user.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

/** frontend/src/messages/terms.ts 의 id 와 같음 */
public enum TermsId {
	SERVICE, PRIVACY, AGE, MARKETING, BUSINESS;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<TermsId> {

		public Db() {
			super(TermsId.class);
		}

	}
}
