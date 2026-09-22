package com.company.market.common.ratelimit;

import java.time.Duration;
import java.util.List;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * Redis 고정 창(fixed window) 카운터. 수치는 security.md "Rate limit" 표가 원본.
 * INCR 와 첫 EXPIRE 를 Lua 로 한 번에 — 따로 보내면 그 사이 죽었을 때 TTL 없는 카운터가 남아 영구 차단이 된다.
 * api-1/api-2 가 카운터를 공유하므로 인스턴스 수와 무관하게 한도가 지켜진다.
 */
@Component
@RequiredArgsConstructor
public class RateLimiter {

	private static final RedisScript<Long> INCR_WITH_TTL = new DefaultRedisScript<>("""
			local c = redis.call('INCR', KEYS[1])
			if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
			return c
			""", Long.class);

	private final StringRedisTemplate redis;

	/** 카운터 +1 하고 현재 값 반환. 한도 판단은 호출자가 */
	public long increment(String key, Duration window) {
		Long count = redis.execute(INCR_WITH_TTL, List.of(key), String.valueOf(window.toSeconds()));
		return count == null ? 0 : count;
	}

	/** 카운터 +1 하고 한도를 넘으면 429 RATE_LIMITED. 한도 이내의 시도만 통과 */
	public void hit(String key, int limit, Duration window) {
		if (increment(key, window) > limit) {
			throw new ApiException(ErrorCode.RATE_LIMITED);
		}
	}

	public void reset(String key) {
		redis.delete(key);
	}

}
