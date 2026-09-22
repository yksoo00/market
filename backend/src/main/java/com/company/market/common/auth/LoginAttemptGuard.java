package com.company.market.common.auth;

import java.time.Duration;
import java.util.List;
import java.util.Locale;

import com.company.market.common.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 로그인 시도 제한 (security.md "인증"): 같은 계정 5회/10분 실패 → 15분 잠금, 같은 IP 30회/10분.
 * 계정 키는 아이디·사업자번호 그대로 (개인정보 아님). 카운터는 Redis 라 api-1/api-2 가 공유한다.
 */
@Component
@RequiredArgsConstructor
public class LoginAttemptGuard {

	private static final int ACCOUNT_LIMIT = 5;

	private static final int IP_LIMIT = 30;

	private static final Duration WINDOW = Duration.ofMinutes(10);

	private static final Duration LOCK = Duration.ofMinutes(15);

	/** INCR 와 첫 EXPIRE 를 한 번에. 따로 보내면 그 사이 죽었을 때 TTL 없는 카운터가 남아 영구 차단이 된다 */
	private static final RedisScript<Long> INCR_WITH_TTL = new DefaultRedisScript<>("""
			local c = redis.call('INCR', KEYS[1])
			if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
			return c
			""", Long.class);

	private final StringRedisTemplate redis;

	/** 시도 전에 호출. 잠겨 있으면 비밀번호를 확인하지 않고 바로 거부 */
	public void check(String account, String ip) {
		if (Boolean.TRUE.equals(redis.hasKey(lockKey(account)))) {
			throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOCKED", "로그인을 5회 이상 실패해 15분간 잠겼습니다.");
		}
		String ipCount = redis.opsForValue().get(ipKey(ip));
		if (ipCount != null && Integer.parseInt(ipCount) >= IP_LIMIT) {
			throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "시도가 너무 많습니다. 잠시 후 다시 시도하세요.");
		}
	}

	public void recordFailure(String account, String ip) {
		long count = increment(accountKey(account));
		if (count >= ACCOUNT_LIMIT) {
			redis.opsForValue().set(lockKey(account), "1", LOCK);
			redis.delete(accountKey(account));
		}
		increment(ipKey(ip));
	}

	public void recordSuccess(String account) {
		redis.delete(accountKey(account));
	}

	private long increment(String key) {
		Long count = redis.execute(INCR_WITH_TTL, List.of(key), String.valueOf(WINDOW.toSeconds()));
		return count == null ? 0 : count;
	}

	private static String accountKey(String account) {
		return "login:fail:user:" + account.toLowerCase(Locale.ROOT);
	}

	private static String lockKey(String account) {
		return "login:lock:" + account.toLowerCase(Locale.ROOT);
	}

	private static String ipKey(String ip) {
		return "login:fail:ip:" + ip;
	}

}
