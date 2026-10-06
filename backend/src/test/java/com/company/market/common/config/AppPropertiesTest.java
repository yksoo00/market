package com.company.market.common.config;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AppPropertiesTest {

	private static AppProperties props(String env, Boolean cookieSecure, String appUrl, List<String> extra) {
		return new AppProperties(env, null, null, null, null, appUrl, null, cookieSecure, extra);
	}

	@Test
	@DisplayName("Secure 쿠키를 끄는 건 APP_ENV=local 에서만 — 운영에서 끄면 기동 실패")
	void insecureCookiesOnlyInLocal() {
		assertThat(props("local", false, "http://localhost:3000", null).cookieSecure()).isFalse();
		assertThatThrownBy(() -> props("prod", false, "https://app.example.com", null))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("COOKIE_SECURE");
		assertThat(props("prod", true, "https://app.example.com", null).cookieSecure()).isTrue();
	}

	@Test
	@DisplayName("허용 출처 = APP_URL + ALLOWED_ORIGINS — 공백·끝 슬래시·빈 값·중복은 정리, 비어 있으면 APP_URL 하나")
	void allowedOriginsAreNormalized() {
		assertThat(props("local", true, "http://localhost:3000/", null).allowedOriginList()).containsExactly("http://localhost:3000");
		assertThat(props("local", true, "http://localhost:3000", List.of(" http://dev-vm.example:4321/ ", "", "http://localhost:3000")).allowedOriginList())
			.containsExactly("http://localhost:3000", "http://dev-vm.example:4321");
	}


	@Test
	@DisplayName("COOKIE_SECURE 가 비어 있으면(바인딩 결과 null) 안전한 쪽인 true")
	void blankCookieSecureMeansSecure() {
		assertThat(props("prod", null, "https://app.example.com", null).cookieSecure()).isTrue();
	}

	@Test
	@DisplayName("APP_URL 이 비어 있으면 허용 출처에 빈 값을 넣지 않는다 (빈 Origin 헤더가 통과하지 않게)")
	void blankAppUrlAllowsNothing() {
		assertThat(props("local", true, "", null).allowedOriginList()).isEmpty();
		assertThat(props("local", true, null, List.of("http://dev-vm.example:4321")).allowedOriginList()).containsExactly("http://dev-vm.example:4321");
	}

	@Test
	@DisplayName("출처는 소문자로 맞춘다 — Origin 검사와 CORS 가 같은 기준으로 비교하게")
	void originsAreLowercased() {
		assertThat(props("local", true, "HTTP://Localhost:3000", List.of("http://Dev-VM.example:4321")).allowedOriginList())
			.containsExactly("http://localhost:3000", "http://dev-vm.example:4321");
	}

}
