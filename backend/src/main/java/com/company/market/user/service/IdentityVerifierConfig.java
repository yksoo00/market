package com.company.market.user.service;

import java.util.Optional;

import com.company.market.common.config.AppProperties;
import com.company.market.common.crypto.PiiHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 본인인증 구현 선택. 환경변수 하나로 stub ↔ 실제 업체를 바꾸고, 기본값(pass)은 stub 을 거부하는 안전한 쪽.
 * 2차 방어: APP_ENV=local 이 아닌데 stub 이면 기동을 막는다 — .env 를 템플릿에서 복사한 운영 서버가 stub 으로 뜨는 사고 방지.
 */
@Configuration
public class IdentityVerifierConfig {

	private static final Logger log = LoggerFactory.getLogger(IdentityVerifierConfig.class);

	@Bean
	IdentityVerifier identityVerifier(AppProperties props, PiiHasher hasher) {
		String provider = props.identityVerification().provider();
		if ("stub".equals(provider)) {
			if (!props.isLocal()) {
				throw new IllegalStateException("IDENTITY_VERIFICATION_PROVIDER=stub 은 APP_ENV=local 에서만 허용 (현재 APP_ENV=" + props.env() + ")");
			}
			log.warn("본인인증이 stub 입니다 — 개발 환경에서만 허용");
			return new StubIdentityVerifier(hasher);
		}
		// TODO(PASS/NICE 계약 후): provider 별 실제 구현. 그때까지는 어떤 토큰도 인증되지 않음 → 가입 불가
		return (token, name, phone) -> Optional.empty();
	}

}
