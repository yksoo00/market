package com.company.market.common.auth.oauth;

import java.util.Map;

import com.company.market.user.domain.SocialProvider;

/**
 * 제공자 응답을 우리 모양으로. 구조가 제공자마다 달라 여기서만 파싱한다:
 * 카카오 `{ id, kakao_account: { email, is_email_verified, profile: { nickname } } }`,
 * 네이버 `{ response: { id, email, name, nickname } }`, 구글(OIDC) `{ sub, email, email_verified, name }`.
 * email 은 동의를 안 하면 null. emailVerified 는 제공자가 알려줄 때만 true (security.md "소셜 로그인").
 */
public record SocialProfile(SocialProvider provider, String providerUserId, String email, boolean emailVerified, String name) {

	public static SocialProfile from(String registrationId, Map<String, Object> attributes) {
		SocialProvider provider = SocialProvider.valueOf(registrationId.toUpperCase(java.util.Locale.ROOT));
		return switch (provider) {
			case KAKAO -> {
				Map<String, Object> account = map(attributes.get("kakao_account"));
				Map<String, Object> profile = map(account.get("profile"));
				yield new SocialProfile(provider, str(attributes.get("id")), blankToNull(str(account.get("email"))),
						Boolean.TRUE.equals(account.get("is_email_verified")), blankToNull(str(profile.get("nickname"))));
			}
			case NAVER -> {
				Map<String, Object> r = map(attributes.get("response"));
				String name = blankToNull(str(r.get("nickname")));
				yield new SocialProfile(provider, str(r.get("id")), blankToNull(str(r.get("email"))),
						// 네이버는 검증 여부를 안 알려준다. 네이버 계정 이메일이라 검증된 것으로 본다
						r.get("email") != null, name != null ? name : blankToNull(str(r.get("name"))));
			}
			case GOOGLE -> new SocialProfile(provider, str(attributes.get("sub")), blankToNull(str(attributes.get("email"))),
					Boolean.TRUE.equals(attributes.get("email_verified")), blankToNull(str(attributes.get("name"))));
		};
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> map(Object o) {
		return o instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
	}

	private static String str(Object o) {
		return o == null ? null : String.valueOf(o);
	}

	private static String blankToNull(String s) {
		return s == null || s.isBlank() ? null : s;
	}

}
