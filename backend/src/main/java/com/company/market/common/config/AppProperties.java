package com.company.market.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 의 `app.*`. 값은 전부 환경변수 (.env) */
@ConfigurationProperties("app")
public record AppProperties(String env, Jwt jwt, Admin admin, IdentityVerification identityVerification, Terms terms,
		String appUrl, String domainRoot) {

	public boolean isLocal() {
		return "local".equals(env);
	}

	public record Jwt(String secret, int accessTtlMinutes, int refreshTtlDays) {
	}

	/** 첫 관리자 시드. 비어 있으면 시드하지 않음 */
	public record Admin(String loginId, String password) {
	}

	/** 본인인증 업체. `stub` 은 개발용 — 운영은 pass/nice 여야 stub 토큰이 거부된다 */
	public record IdentityVerification(String provider) {
	}

	/** 지금 시행 중인 약관 버전(시행일). 문안이 바뀌면 이 값을 올려 재동의를 받는다 */
	public record Terms(String version) {
	}

}
