package com.company.market.common.auth.oauth;

import java.util.Map;

import com.company.market.user.domain.SocialProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 제공자 응답 샘플은 각 개발자 문서의 형태. 구조가 바뀌면 여기가 먼저 깨진다 */
class SocialProfileTest {

	@Test
	@DisplayName("카카오: id 는 숫자, 이메일·닉네임은 kakao_account 안. 동의 안 하면 이메일 null")
	void kakao() {
		SocialProfile p = SocialProfile.from("kakao", Map.of(
				"id", 123456789L,
				"kakao_account", Map.of("email", "a@kakao.com", "is_email_verified", true, "profile", Map.of("nickname", "길동"))));
		assertThat(p).isEqualTo(new SocialProfile(SocialProvider.KAKAO, "123456789", "a@kakao.com", true, "길동"));

		SocialProfile noEmail = SocialProfile.from("kakao", Map.of("id", 1L, "kakao_account", Map.of("profile", Map.of("nickname", "길동"))));
		assertThat(noEmail.email()).isNull();
		assertThat(noEmail.emailVerified()).isFalse();
	}

	@Test
	@DisplayName("네이버: 전부 response 안. 별명이 없으면 이름을 닉네임 후보로")
	void naver() {
		SocialProfile p = SocialProfile.from("naver", Map.of("resultcode", "00",
				"response", Map.of("id", "abc-123", "email", "b@naver.com", "name", "홍길동")));
		assertThat(p).isEqualTo(new SocialProfile(SocialProvider.NAVER, "abc-123", "b@naver.com", true, "홍길동"));
	}

	@Test
	@DisplayName("구글(OIDC): sub·email·email_verified·name")
	void google() {
		SocialProfile p = SocialProfile.from("google", Map.of("sub", "10001", "email", "c@gmail.com", "email_verified", false, "name", "Gil Dong"));
		assertThat(p).isEqualTo(new SocialProfile(SocialProvider.GOOGLE, "10001", "c@gmail.com", false, "Gil Dong"));
	}

}
