package com.company.market.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 의 `app.*`. 값은 전부 환경변수 (.env) */
@ConfigurationProperties("app")
public record AppProperties(Jwt jwt, Admin admin, String appUrl, String domainRoot) {

	public record Jwt(String secret, int accessTtlMinutes, int refreshTtlDays) {
	}

	/** 첫 관리자 시드. 비어 있으면 시드하지 않음 */
	public record Admin(String loginId, String password) {
	}

}
