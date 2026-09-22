package com.company.market.common.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import com.company.market.common.config.AppProperties;
import com.company.market.common.crypto.PiiHasher;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * refresh 세션. Redis `session:{userId}:{deviceId}` → "토큰 비밀값의 해시 remember", TTL 30일 (security.md "인증").
 * 토큰 문자열은 `{userId}.{deviceId}.{secret}` — 쿠키만 보고 키를 찾을 수 있어야 해서 userId·deviceId 를 같이 담는다.
 * 원문은 어디에도 저장하지 않는다. 회전: 사용할 때마다 secret 을 새로 발급하고 같은 키에 덮어쓴다.
 * 직전 해시는 `…:prev` 에 30초만 남긴다 — 탭 여러 개가 동시에 401 을 받아 refresh 를 겹쳐 부르는 정상 상황을 탈취로 오판하지 않기 위해.
 */
@Component
public class RefreshSessionStore {

	private static final String KEY_PREFIX = "session:";

	private static final Duration PREVIOUS_GRACE = Duration.ofSeconds(30);

	private final StringRedisTemplate redis;

	private final PiiHasher hasher;

	private final Duration ttl;

	private final SecureRandom random = new SecureRandom();

	public RefreshSessionStore(StringRedisTemplate redis, PiiHasher hasher, AppProperties props) {
		this.redis = redis;
		this.hasher = hasher;
		this.ttl = Duration.ofDays(props.jwt().refreshTtlDays());
	}

	/** 새 기기 로그인. 반환값이 쿠키에 들어갈 토큰 */
	public String issue(UUID userId, boolean remember) {
		return issue(userId, UUID.randomUUID(), remember);
	}

	/**
	 * 토큰 검증 후 같은 기기로 새 토큰 발급(회전). 저장된 해시(또는 30초 내 직전 해시)와 다르면 이미 회전된 옛 토큰을
	 * 누가 다시 쓴 것 — 탈취 의심으로 그 사용자의 모든 세션을 지우고 empty. 키가 없으면(만료·로그아웃) 그냥 empty.
	 */
	public Optional<Rotated> rotate(String token) {
		Parsed p = parse(token).orElse(null);
		if (p == null) {
			return Optional.empty();
		}
		String key = key(p.userId(), p.deviceId());
		Stored current = Stored.parse(redis.opsForValue().get(key));
		if (current == null) {
			return Optional.empty();
		}
		String hash = hasher.hash(p.secret());
		boolean matchesCurrent = current.hash().equals(hash);
		boolean matchesPrevious = hash.equals(redis.opsForValue().get(key + ":prev"));
		if (!matchesCurrent && !matchesPrevious) {
			revokeAll(p.userId());
			return Optional.empty();
		}
		if (matchesCurrent) {
			redis.opsForValue().set(key + ":prev", hash, PREVIOUS_GRACE);
		}
		return Optional.of(new Rotated(p.userId(), issue(p.userId(), p.deviceId(), current.remember()), current.remember()));
	}

	/** 로그아웃. 비밀값이 맞는 토큰만 지운다 — userId·deviceId 만 알고 남의 기기를 로그아웃시킬 수 없게. 이상한 토큰은 조용히 무시 */
	public void revoke(String token) {
		parse(token).ifPresent(p -> {
			String key = key(p.userId(), p.deviceId());
			Stored current = Stored.parse(redis.opsForValue().get(key));
			String hash = hasher.hash(p.secret());
			if (current != null && (current.hash().equals(hash) || hash.equals(redis.opsForValue().get(key + ":prev")))) {
				redis.delete(key);
				redis.delete(key + ":prev");
			}
		});
	}

	/** 모든 기기에서 로그아웃 / 탈취 의심 시. `:prev` 키도 같은 접두어라 함께 지워진다 */
	public void revokeAll(UUID userId) {
		try (Cursor<String> cursor = redis.scan(ScanOptions.scanOptions().match(KEY_PREFIX + userId + ":*").count(100).build())) {
			cursor.forEachRemaining(redis::delete);
		}
	}

	public record Rotated(UUID userId, String token, boolean remember) {
	}

	private String issue(UUID userId, UUID deviceId, boolean remember) {
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String secret = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		redis.opsForValue().set(key(userId, deviceId), new Stored(hasher.hash(secret), remember).serialize(), ttl);
		return userId + "." + deviceId + "." + secret;
	}

	private static String key(UUID userId, UUID deviceId) {
		return KEY_PREFIX + userId + ":" + deviceId;
	}

	/** Redis 값: "해시 remember". remember 는 회전 때 쿠키 종류(영구/세션)를 유지하기 위해 */
	private record Stored(String hash, boolean remember) {

		String serialize() {
			return hash + " " + (remember ? "1" : "0");
		}

		static Stored parse(String value) {
			if (value == null) {
				return null;
			}
			int sp = value.indexOf(' ');
			return sp < 0 ? new Stored(value, true) : new Stored(value.substring(0, sp), "1".equals(value.substring(sp + 1)));
		}

	}

	private record Parsed(UUID userId, UUID deviceId, String secret) {
	}

	private static Optional<Parsed> parse(String token) {
		String[] parts = token.split("\\.", 3);
		if (parts.length != 3 || parts[2].isBlank()) {
			return Optional.empty();
		}
		try {
			return Optional.of(new Parsed(UUID.fromString(parts[0]), UUID.fromString(parts[1]), parts[2]));
		}
		catch (IllegalArgumentException e) {
			return Optional.empty();
		}
	}

}
