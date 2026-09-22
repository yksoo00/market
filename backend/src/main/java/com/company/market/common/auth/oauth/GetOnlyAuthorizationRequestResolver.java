package com.company.market.common.auth.oauth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * 기본 리졸버는 `/api/v1/auth/oauth/{registrationId}` 를 메서드 무관하게 잡아서 `POST /api/v1/auth/oauth/complete` 가
 * "complete 라는 제공자 없음" 으로 죽는다. 인가 시작은 GET 뿐이므로 GET 만, 그리고 등록된 제공자일 때만 위임한다.
 * 없는 제공자(/oauth/facebook)는 스프링이 빈 500 을 내므로 null 로 돌려 체인을 계속 타게 → 우리 404 JSON.
 */
public class GetOnlyAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

	public static final String BASE_URI = "/api/v1/auth/oauth";

	private final ClientRegistrationRepository registrations;

	private final DefaultOAuth2AuthorizationRequestResolver delegate;

	public GetOnlyAuthorizationRequestResolver(ClientRegistrationRepository registrations) {
		this.registrations = registrations;
		this.delegate = new DefaultOAuth2AuthorizationRequestResolver(registrations, BASE_URI);
	}

	@Override
	public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
		return isKnownProvider(request, registrationIdFrom(request)) ? delegate.resolve(request) : null;
	}

	@Override
	public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
		return isKnownProvider(request, clientRegistrationId) ? delegate.resolve(request, clientRegistrationId) : null;
	}

	private boolean isKnownProvider(HttpServletRequest request, String registrationId) {
		return "GET".equals(request.getMethod()) && registrationId != null && registrations.findByRegistrationId(registrationId) != null;
	}

	/** `/api/v1/auth/oauth/kakao` → kakao. 그 아래 경로(/callback)나 다른 경로는 null */
	private static String registrationIdFrom(HttpServletRequest request) {
		String path = request.getRequestURI();
		if (path == null || !path.startsWith(BASE_URI + "/")) {
			return null;
		}
		String rest = path.substring(BASE_URI.length() + 1);
		return rest.isEmpty() || rest.contains("/") ? null : rest;
	}

}
