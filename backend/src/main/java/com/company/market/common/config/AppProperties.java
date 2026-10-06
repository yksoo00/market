package com.company.market.common.config;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 의 `app.*`. 값은 전부 환경변수 (.env) */
@ConfigurationProperties("app")
public record AppProperties(String env, Jwt jwt, Admin admin, IdentityVerification identityVerification, Terms terms,
		String appUrl, String domainRoot, Boolean cookieSecure, List<String> allowedOrigins) {

	public AppProperties {
		// 비어 있으면(COOKIE_SECURE= 처럼 바인딩 결과가 null) 안전한 쪽인 true
		cookieSecure = cookieSecure == null || cookieSecure;
		// 운영은 https 라 Secure 쿠키여야 한다. 끄는 건 http 로 쓰는 로컬 개발(다른 PC 에서 VM 으로 접속 등)에서만
		if (!cookieSecure && !"local".equals(env)) {
			throw new IllegalStateException("COOKIE_SECURE=false 는 APP_ENV=local 에서만 허용 (현재 APP_ENV=" + env + ")");
		}
		allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
	}

	/**
	 * CORS·Origin 검사가 허용하는 프론트 출처 = APP_URL + ALLOWED_ORIGINS(쉼표 목록). 같은 개발 서버를 localhost 와
	 * 다른 주소로 함께 쓸 때만 ALLOWED_ORIGINS 를 채운다. 공백·끝 슬래시·빈 값·중복은 정리한다. 와일드카드는 없다
	 */
	public List<String> allowedOriginList() {
		Set<String> origins = new LinkedHashSet<>();
		// 빈 APP_URL 이 "" 출처로 들어가 빈 Origin 헤더를 통과시키지 않게 비어 있으면 넣지 않는다
		for (String o : Stream.concat(Stream.of(appUrl), allowedOrigins.stream()).toList()) {
			String n = normalizeOrigin(o);
			if (!n.isEmpty()) {
				origins.add(n);
			}
		}
		return List.copyOf(origins);
	}

	private static String normalizeOrigin(String origin) {
		String s = origin == null ? "" : origin.trim();
		// 스킴·호스트는 대소문자를 가리지 않는다 — Origin 검사(소문자 비교)와 CORS(정확히 비교)가 같은 기준이 되게 소문자로
		return (s.endsWith("/") ? s.substring(0, s.length() - 1) : s).toLowerCase();
	}

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
