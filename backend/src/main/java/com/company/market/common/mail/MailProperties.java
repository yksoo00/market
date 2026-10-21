package com.company.market.common.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * `app.mail.*` (.env 의 MAIL_*). host 가 비면 메일을 보내지 않고 로그만 남긴다(로컬·테스트).
 * spring.mail.* 대신 따로 둔 이유: spring.mail.host 는 빈 값이어도 Boot 자동 설정이 켜져 빈 호스트로 보내려 한다.
 * async: 거래 메일을 별도 스레드로 보낸다(기본 true). 테스트만 false — 요청이 끝난 직후 보낸 메일을 바로 확인하려고
 */
@ConfigurationProperties("app.mail")
public record MailProperties(String host, Integer port, String username, String password, String from, Boolean async) {

	public boolean enabled() {
		return host != null && !host.isBlank();
	}

	public boolean isAsync() {
		return async == null || async;
	}

}
