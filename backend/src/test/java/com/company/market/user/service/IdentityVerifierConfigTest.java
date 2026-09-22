package com.company.market.user.service;

import com.company.market.common.config.AppProperties;
import com.company.market.common.crypto.PiiHasher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 운영(APP_ENV≠local)에서 stub 이 켜지면 앱이 뜨지 않아야 한다. 스프링 없이 빈 메서드를 직접 호출 */
class IdentityVerifierConfigTest {

	private static final PiiHasher HASHER = new PiiHasher("dGVzdC1waWkta2V5LXRlc3QtcGlpLWtleS0zMmJ5dGU=");

	private static AppProperties props(String env, String provider) {
		return new AppProperties(env, null, null, new AppProperties.IdentityVerification(provider), null, null, null);
	}

	@Test
	@DisplayName("APP_ENV=prod 인데 stub 이면 기동 실패")
	void stubOutsideLocalFailsStartup() {
		assertThatThrownBy(() -> new IdentityVerifierConfig().identityVerifier(props("prod", "stub"), HASHER))
			.isInstanceOf(IllegalStateException.class).hasMessageContaining("APP_ENV=local");
	}

	@Test
	@DisplayName("APP_ENV=local 이면 stub 허용, pass 는 어떤 토큰도 인증하지 않음")
	void localAllowsStubAndPassRejectsAll() {
		IdentityVerifier stub = new IdentityVerifierConfig().identityVerifier(props("local", "stub"), HASHER);
		IdentityVerifier pass = new IdentityVerifierConfig().identityVerifier(props("prod", "pass"), HASHER);

		assertThat(stub.resolve("stub-verification-token", "홍길동", "01012345678")).isPresent();
		assertThat(pass.resolve("stub-verification-token", "홍길동", "01012345678")).isEmpty();
	}

}
