package com.company.market.common.idempotency;

import java.time.Duration;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotency-Key 헤더로 "응답을 못 받아 다시 보낸 생성 요청"이 두 번 만들지 않게 한다.
 * Redis idem:<scope>:<userId>:<key> 에 처리 중이면 PENDING, 끝나면 만든 리소스의 id 를 24시간 둔다.
 * 같은 키가 다시 오면 처리 중은 409, 끝났으면 처음 결과를 다시 돌려준다. 실패하면 키를 풀어 고쳐서 다시 보낼 수 있다.
 * 헤더는 선택 — 없으면 그냥 실행한다 (Bruno·다른 클라이언트 호환).
 */
@Component
@RequiredArgsConstructor
public class IdempotencyGuard {

	static final String PENDING = "PENDING";

	/** 처리 중 표시의 수명. 서버가 처리 도중 죽어도 이 시간이 지나면 같은 키로 다시 보낼 수 있다 */
	private static final Duration PENDING_TTL = Duration.ofMinutes(1);

	/** 결과 보관. 프론트는 폼을 연 동안 같은 키를 쓰므로 하루면 충분하다 */
	private static final Duration RESULT_TTL = Duration.ofHours(24);

	private final StringRedisTemplate redis;

	/**
	 * @param key 헤더 값. null 이면 action 만 실행
	 * @param idOf 결과 → 다시 찾을 id (Redis 에 저장)
	 * @param replay 저장된 id → 처음 결과
	 */
	public <T> T run(String scope, UUID userId, String key, Supplier<T> action, Function<T, String> idOf,
			Function<String, T> replay) {
		if (key == null) {
			return action.get();
		}
		String redisKey = "idem:" + scope + ":" + userId + ":" + parse(key);
		if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(redisKey, PENDING, PENDING_TTL))) {
			String stored = redis.opsForValue().get(redisKey);
			// 확인하는 사이 처음 요청이 실패해 키가 풀렸으면(null) 아직 끝난 결과가 없으므로 처리 중과 같게
			if (stored == null || PENDING.equals(stored)) {
				throw new ApiException(ErrorCode.REQUEST_IN_PROGRESS);
			}
			return replay.apply(stored);
		}
		T result;
		try {
			result = action.get();
		}
		catch (RuntimeException e) {
			redis.delete(redisKey);
			throw e;
		}
		redis.opsForValue().set(redisKey, idOf.apply(result), RESULT_TTL);
		return result;
	}

	/** UUID 형식만 받는다 — 아무 문자열이나 Redis 키에 들어가지 않게 */
	private static String parse(String key) {
		try {
			return UUID.fromString(key).toString();
		}
		catch (IllegalArgumentException e) {
			throw new ApiException(ErrorCode.BAD_REQUEST);
		}
	}

}
