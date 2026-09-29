package com.company.market.user.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

import com.company.market.common.auth.oauth.SocialProfile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * 소셜 첫 로그인 → 가입 마무리 사이의 프로필 보관. Redis `signup:oauth:{token}` 10분 (data-model.md "Redis 키").
 * 프론트는 토큰만 들고 다니고 프로필(이메일 등)은 서버에만 있다. 가입이 끝나면 지운다.
 * 콜백을 완성한 브라우저의 oauth_flow 해시와 묶어 저장하고, 마무리 때 같은 쿠키를 요구한다 (다른 브라우저에 토큰을 넘겨 가입시키는 고정 공격 방지).
 */
// @Component // 소셜 로그인을 다시 도입할 때 활성화
public class OAuthSignupStore {

	private static final String KEY_PREFIX = "signup:oauth:";

	private static final Duration TTL = Duration.ofMinutes(10);

	private final StringRedisTemplate redis;

	private final ObjectMapper json;

	private final SecureRandom random = new SecureRandom();

	public OAuthSignupStore(StringRedisTemplate redis, ObjectMapper json) {
		this.redis = redis;
		this.json = json;
	}

	public String save(SocialProfile profile, String flowHash) {
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		redis.opsForValue().set(KEY_PREFIX + token, json.writeValueAsString(new Stored(profile, flowHash)), TTL);
		return token;
	}

	public Optional<SocialProfile> find(String token, String flowHash) {
		if (token == null || token.isBlank() || flowHash == null) {
			return Optional.empty();
		}
		String value = redis.opsForValue().get(KEY_PREFIX + token);
		if (value == null) {
			return Optional.empty();
		}
		Stored stored = json.readValue(value, Stored.class);
		return flowHash.equals(stored.flowHash()) ? Optional.of(stored.profile()) : Optional.empty();
	}

	record Stored(SocialProfile profile, String flowHash) {
	}

	public void delete(String token) {
		redis.delete(KEY_PREFIX + token);
	}

}
