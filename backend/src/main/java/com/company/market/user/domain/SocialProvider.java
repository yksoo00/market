package com.company.market.user.domain;

import com.company.market.common.domain.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

public enum SocialProvider {
	KAKAO, NAVER, GOOGLE;

	@Converter(autoApply = true)
	public static class Db extends LowerCaseEnumConverter<SocialProvider> {

		public Db() {
			super(SocialProvider.class);
		}

	}
}
