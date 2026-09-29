package com.company.market.common.auth.oauth;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.company.market.common.auth.AuthCookies;
import com.company.market.common.crypto.PiiHasher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * OAuth 인가 요청(state 등)을 Redis 에. 스프링 기본은 HTTP 세션인데 백엔드는 stateless 라 세션이 없고,
 * api-1 에서 시작한 로그인의 콜백이 api-2 로 올 수 있다. 키 `oauth:state:{state}`, 10분 (data-model.md "Redis 키").
 * 로그인 뒤 돌아갈 `next` 도 같이 저장했다가 콜백 요청의 attribute 로 넘긴다.
 *
 * 브라우저 묶기: 세션이면 "시작한 브라우저만 콜백을 완성할 수 있다"가 공짜인데 Redis 는 state 만 알면 누구든 완성한다 →
 * 공격자가 자기 계정으로 시작한 콜백 URL 을 피해자에게 열게 해 피해자를 공격자 계정으로 로그인시킬 수 있다(로그인 CSRF).
 * 그래서 시작 때 무작위 값을 `oauth_flow` 쿠키로 주고 그 해시를 같이 저장, 콜백에서 쿠키가 맞아야만 꺼내준다.
 */
// @Component // 소셜 로그인을 다시 도입할 때 활성화
public class RedisAuthorizationRequestRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

	/** 콜백 처리 중 성공 핸들러가 읽는 request attribute */
	public static final String NEXT_ATTRIBUTE = RedisAuthorizationRequestRepository.class.getName() + ".next";

	/** 검증된 흐름 쿠키의 해시. 가입 마무리 토큰에 같이 묶는다 */
	public static final String FLOW_HASH_ATTRIBUTE = RedisAuthorizationRequestRepository.class.getName() + ".flowHash";

	private static final String KEY_PREFIX = "oauth:state:";

	private static final Duration TTL = Duration.ofMinutes(10);

	private final StringRedisTemplate redis;

	private final ObjectMapper json;

	private final AuthCookies cookies;

	private final PiiHasher hasher;

	private final SecureRandom random = new SecureRandom();

	public RedisAuthorizationRequestRepository(StringRedisTemplate redis, ObjectMapper json, AuthCookies cookies, PiiHasher hasher) {
		this.redis = redis;
		this.json = json;
		this.cookies = cookies;
		this.hasher = hasher;
	}

	@Override
	public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
		Stored stored = loadBoundTo(request);
		return stored == null ? null : stored.toAuthorizationRequest();
	}

	@Override
	public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request,
			HttpServletResponse response) {
		if (authorizationRequest == null) {
			return;
		}
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String flow = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		cookies.setOAuthFlow(response, flow);
		Stored stored = Stored.from(authorizationRequest, safeNext(request.getParameter("next")), hasher.hash(flow));
		redis.opsForValue().set(KEY_PREFIX + authorizationRequest.getState(), json.writeValueAsString(stored), TTL);
	}

	@Override
	public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
		Stored stored = loadBoundTo(request);
		if (stored == null) {
			return null;
		}
		redis.delete(KEY_PREFIX + request.getParameter(OAuth2ParameterNames.STATE));
		request.setAttribute(NEXT_ATTRIBUTE, stored.next());
		request.setAttribute(FLOW_HASH_ATTRIBUTE, stored.flowHash());
		return stored.toAuthorizationRequest();
	}

	/** state 로 찾되, 시작한 브라우저의 oauth_flow 쿠키와 맞을 때만 돌려준다 */
	private Stored loadBoundTo(HttpServletRequest request) {
		String state = request.getParameter(OAuth2ParameterNames.STATE);
		if (state == null || state.isBlank()) {
			return null;
		}
		String value = redis.opsForValue().get(KEY_PREFIX + state);
		if (value == null) {
			return null;
		}
		Stored stored = json.readValue(value, Stored.class);
		String flow = cookies.read(request, AuthCookies.OAUTH_FLOW).orElse(null);
		return flow != null && hasher.hash(flow).equals(stored.flowHash()) ? stored : null;
	}

	/** 프론트 safeNext 와 같은 규칙: 우리 경로만. 외부 URL·`//host` 로의 리다이렉트 방지 */
	static String safeNext(String raw) {
		if (raw == null || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
			return "/";
		}
		return raw;
	}

	/** Redis 에 넣는 모양. OAuth2AuthorizationRequest 를 그대로 직렬화하지 않고 필요한 필드만 — 스프링 버전이 바뀌어도 값이 안 깨지게 */
	record Stored(String clientId, String authorizationUri, String redirectUri, List<String> scopes, String state,
			Map<String, String> additionalParameters, Map<String, String> attributes, String authorizationRequestUri, String next,
			String flowHash) {

		static Stored from(OAuth2AuthorizationRequest r, String next, String flowHash) {
			Map<String, String> additional = new LinkedHashMap<>();
			r.getAdditionalParameters().forEach((k, v) -> additional.put(k, String.valueOf(v)));
			Map<String, String> attributes = new LinkedHashMap<>();
			r.getAttributes().forEach((k, v) -> attributes.put(k, String.valueOf(v)));
			return new Stored(r.getClientId(), r.getAuthorizationUri(), r.getRedirectUri(), List.copyOf(r.getScopes()), r.getState(),
					additional, attributes, r.getAuthorizationRequestUri(), next, flowHash);
		}

		OAuth2AuthorizationRequest toAuthorizationRequest() {
			return OAuth2AuthorizationRequest.authorizationCode()
				.clientId(clientId)
				.authorizationUri(authorizationUri)
				.redirectUri(redirectUri)
				.scopes(Set.copyOf(scopes))
				.state(state)
				.additionalParameters(Map.copyOf(additionalParameters))
				.attributes(Map.copyOf(attributes))
				.authorizationRequestUri(authorizationRequestUri)
				.build();
		}

	}

}
