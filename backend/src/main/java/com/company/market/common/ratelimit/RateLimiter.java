package com.company.market.common.ratelimit;

import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
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

	/** 더해도 한도 이하일 때만 INCRBY. 넘으면 그대로 두고 -1 — 거부된 요청이 사용량을 깎지 않게 */
	private static final RedisScript<Long> INCRBY_IF_WITHIN = new DefaultRedisScript<>("""
			local c = tonumber(redis.call('GET', KEYS[1]) or '0')
			local amount = tonumber(ARGV[1])
			if c + amount > tonumber(ARGV[2]) then return -1 end
			local n = redis.call('INCRBY', KEYS[1], amount)
			if n == amount then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
			return n
			""", Long.class);

	/** 0 아래로는 내리지 않는다 — 그 사이 창이 끝나 키가 사라졌으면 -1 이 남지 않게 */
	private static final RedisScript<Long> DECR_IF_POSITIVE = new DefaultRedisScript<>("""
			local c = tonumber(redis.call('GET', KEYS[1]) or '0')
			if c > 0 then return redis.call('DECR', KEYS[1]) end
			return 0
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

	/** 양(바이트 등) 기준 고정 창 한도. amount 를 더해도 limit 이하면 반영하고 true, 넘으면 반영 없이 false */
	public boolean tryConsume(String key, long amount, long limit, Duration window) {
		Long result = redis.execute(INCRBY_IF_WITHIN, List.of(key), String.valueOf(amount), String.valueOf(limit),
				String.valueOf(window.toSeconds()));
		return result != null && result >= 0;
	}

	/**
	 * hit 한 뒤 action 을 실행하고, action 이 입력 검증 실패(ValidationException)로 끝나면 이번 시도를 되돌린다.
	 * Bean Validation 실패는 메서드에 들어오기 전에 400 이라 원래 세지 않는데, 서비스에서 보는 검증(두 칸 비교·파일 키)만
	 * 한도를 깎으면 고쳐서 다시 보내는 사용자가 막힌다. 검증 실패는 아무것도 만들지 않으므로 세지 않는다.
	 */
	public <T> T hitUnlessInvalid(String key, int limit, Duration window, Supplier<T> action) {
		hit(key, limit, window);
		try {
			return action.get();
		}
		catch (ValidationException e) {
			redis.execute(DECR_IF_POSITIVE, List.of(key));
			throw e;
		}
	}


	public void reset(String key) {
		redis.delete(key);
	}

}
