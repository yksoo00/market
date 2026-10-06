package com.company.market.common.auth;

import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

import com.company.market.common.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * 토큰은 둘 다 httpOnly·Secure·SameSite=Lax 쿠키 (security.md "인증"). localStorage 금지.
 * refresh 쿠키는 Path=/api/v1/auth 로 좁혀 다른 API 호출에는 실려 가지 않게.
 */
@Component
public class AuthCookies {

	public static final String ACCESS = "access_token";

	public static final String REFRESH = "refresh_token";

	public static final String REFRESH_PATH = "/api/v1/auth";

	/** 소셜 로그인 흐름을 시작한 브라우저 표식. 콜백·가입 마무리가 같은 브라우저에서 오는지 확인 (로그인 CSRF 방지) */
	public static final String OAUTH_FLOW = "oauth_flow";

	public static final String OAUTH_FLOW_PATH = "/api/v1/auth/oauth";

	private static final Duration OAUTH_FLOW_TTL = Duration.ofMinutes(10);

	private final Duration accessTtl;

	private final Duration refreshTtl;

	/** localhost 면 Domain 속성을 안 붙인다 (브라우저가 거부). 운영은 루트 도메인으로 app./api. 공유 */
	private final String domain;

	/** 운영은 항상 true. false 는 http 로 쓰는 로컬 개발에서만 (AppProperties 가 local 이 아니면 기동을 막는다) */
	private final boolean secure;

	public AuthCookies(AppProperties props, JwtProvider jwt) {
		this.accessTtl = jwt.accessTtl();
		this.refreshTtl = Duration.ofDays(props.jwt().refreshTtlDays());
		this.secure = props.cookieSecure();
		String appHost = URI.create(props.appUrl()).getHost();
		// 로컬 개발(local)이거나 호스트가 localhost·IP 주소면 Domain 을 안 붙인다 — 브라우저가 호스트와 안 맞는 Domain 을 거부해 로그인이 안 남는다
		this.domain = props.isLocal() || appHost == null || "localhost".equalsIgnoreCase(appHost) || isIpLiteral(appHost) ? null
				: props.domainRoot();
	}

	private static boolean isIpLiteral(String host) {
		return host.matches("\\d{1,3}(\\.\\d{1,3}){3}") || host.startsWith("[") || host.contains(":");
	}

	public void setLogin(HttpServletResponse res, String accessToken, String refreshToken, boolean remember) {
		add(res, build(ACCESS, accessToken, "/", accessTtl));
		// remember 가 아니면 브라우저 세션 쿠키(만료 없음) — 창을 닫으면 사라짐. 서버 쪽 TTL 은 동일
		add(res, build(REFRESH, refreshToken, REFRESH_PATH, remember ? refreshTtl : null));
	}

	public void clear(HttpServletResponse res) {
		add(res, build(ACCESS, "", "/", Duration.ZERO));
		add(res, build(REFRESH, "", REFRESH_PATH, Duration.ZERO));
	}

	public void setOAuthFlow(HttpServletResponse res, String value) {
		add(res, build(OAUTH_FLOW, value, OAUTH_FLOW_PATH, OAUTH_FLOW_TTL));
	}

	public void clearOAuthFlow(HttpServletResponse res) {
		add(res, build(OAUTH_FLOW, "", OAUTH_FLOW_PATH, Duration.ZERO));
	}

	public Optional<String> read(HttpServletRequest req, String name) {
		Cookie[] cookies = req.getCookies();
		if (cookies == null) {
			return Optional.empty();
		}
		return Arrays.stream(cookies).filter(c -> name.equals(c.getName())).map(Cookie::getValue).filter(v -> !v.isBlank()).findFirst();
	}

	private ResponseCookie build(String name, String value, String path, Duration maxAge) {
		ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(name, value).httpOnly(true).secure(secure).sameSite("Lax").path(path);
		if (maxAge != null) {
			b.maxAge(maxAge);
		}
		if (domain != null) {
			b.domain(domain);
		}
		return b.build();
	}

	private static void add(HttpServletResponse res, ResponseCookie cookie) {
		res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

}
