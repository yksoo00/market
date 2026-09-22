package com.company.market.common.auth.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.stereotype.Component;

/**
 * 제공자 access/refresh 토큰을 저장하지 않는다. 스프링 기본은 JVM 메모리 맵(InMemoryOAuth2AuthorizedClientService)에 영구
 * 보관 — stateless 규칙 위반이고 지워지지도 않는다. 우리는 로그인 직후 프로필만 쓰고 제공자 API 를 다시 부르지 않으므로 필요 없다.
 * 나중에 제공자 API(친구 목록 등)가 필요해지면 Redis 저장소로 바꾼다.
 */
@Component
public class NoopAuthorizedClientRepository implements OAuth2AuthorizedClientRepository {

	@Override
	public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(String clientRegistrationId, Authentication principal,
			HttpServletRequest request) {
		return null;
	}

	@Override
	public void saveAuthorizedClient(OAuth2AuthorizedClient authorizedClient, Authentication principal, HttpServletRequest request,
			HttpServletResponse response) {
	}

	@Override
	public void removeAuthorizedClient(String clientRegistrationId, Authentication principal, HttpServletRequest request,
			HttpServletResponse response) {
	}

}
