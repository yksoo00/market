package com.company.market.common.auth.oauth;

import java.io.IOException;

import com.company.market.common.auth.AuthCookies;
import com.company.market.common.config.AppProperties;
import com.company.market.common.exception.ErrorCode;
import com.company.market.user.service.OAuthLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 콜백의 끝: 제공자 인증이 끝난 뒤 우리 계정으로 잇고 프론트로 돌려보낸다. 응답은 항상 302 (브라우저가 와 있으므로 JSON 을
 * 줄 수 없다). 오류는 `/login?error=CODE` 로, 신규는 `/signup/social?...` 로, 성공은 쿠키 + next 로.
 */
// @Component // 소셜 로그인을 다시 도입할 때 활성화
public class OAuthLoginHandlers implements AuthenticationSuccessHandler, AuthenticationFailureHandler {

	private static final Logger log = LoggerFactory.getLogger(OAuthLoginHandlers.class);

	private final OAuthLoginService service;

	private final AuthCookies cookies;

	private final String appUrl;

	public OAuthLoginHandlers(OAuthLoginService service, AuthCookies cookies, AppProperties props) {
		this.service = service;
		this.cookies = cookies;
		this.appUrl = props.appUrl();
	}

	@Override
	public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
			throws IOException {
		OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
		SocialProfile profile = SocialProfile.from(token.getAuthorizedClientRegistrationId(), token.getPrincipal().getAttributes());
		Object nextAttr = request.getAttribute(RedisAuthorizationRequestRepository.NEXT_ATTRIBUTE);
		String next = RedisAuthorizationRequestRepository.safeNext(nextAttr == null ? null : nextAttr.toString());
		Object flowHash = request.getAttribute(RedisAuthorizationRequestRepository.FLOW_HASH_ATTRIBUTE);

		String redirect = switch (service.handleCallback(profile, flowHash == null ? null : flowHash.toString())) {
			case OAuthLoginService.LoggedIn in -> {
				cookies.clearOAuthFlow(response);
				cookies.setLogin(response, in.result().accessToken(), in.result().refreshToken(), in.result().remember());
				// next 에 한글·공백이 있으면 Location 헤더가 깨진다(Tomcat 은 ISO-8859-1 만). 경로·쿼리를 각각 인코딩
				yield UriComponentsBuilder.fromUriString(appUrl + next).encode().build().toUriString();
			}
			case OAuthLoginService.NeedsSignup s -> UriComponentsBuilder.fromUriString(appUrl + "/signup/social")
				.queryParam("provider", profile.provider().name().toLowerCase(java.util.Locale.ROOT))
				.queryParam("token", s.token())
				.queryParam("nickname", s.suggestedNickname() == null ? "" : s.suggestedNickname())
				.queryParam("next", next)
				.encode().build().toUriString();
			// NeedsSignup 은 쿠키를 남긴다 — /oauth/complete 가 같은 브라우저인지 확인하는 데 쓴다
			case OAuthLoginService.Rejected r -> {
				cookies.clearOAuthFlow(response);
				yield loginError(r.code(), r.method());
			}
		};
		response.sendRedirect(redirect);
	}

	@Override
	public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
			throws IOException {
		// 사용자가 동의 화면에서 취소했거나 state 불일치·토큰 교환 실패. 프론트엔 구분 없이, 로그엔 이유를 (콘솔 설정 오류 진단용)
		String reason = exception instanceof OAuth2AuthenticationException oe
				? oe.getError().getErrorCode() + " " + oe.getError().getDescription() : exception.getMessage();
		log.warn("소셜 로그인 실패 uri={} reason={}", request.getRequestURI(), reason);
		cookies.clearOAuthFlow(response);
		response.sendRedirect(loginError(ErrorCode.OAUTH_FAILED, null));
	}

	private String loginError(ErrorCode code, String method) {
		UriComponentsBuilder b = UriComponentsBuilder.fromUriString(appUrl + "/login").queryParam("error", code.name());
		if (method != null) {
			b.queryParam("method", method);
		}
		return b.encode().build().toUriString();
	}

}
