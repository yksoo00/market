package com.company.market.common.auth;

import java.time.Duration;
import java.util.Locale;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.ratelimit.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 로그인 시도 제한 (security.md "인증"): 같은 계정 5회/10분 실패 → 15분 잠금, 같은 IP 30회/10분.
 * 계정 키는 아이디·사업자번호 그대로 (개인정보 아님). 카운터는 Redis 라 api-1/api-2 가 공유한다.
 */
@Component
@RequiredArgsConstructor
public class LoginAttemptGuard {

	private static final Logger log = LoggerFactory.getLogger(LoginAttemptGuard.class);

	private static final int ACCOUNT_LIMIT = 5;

	private static final int IP_LIMIT = 30;

	private static final Duration WINDOW = Duration.ofMinutes(10);

	private static final Duration LOCK = Duration.ofMinutes(15);

	private final StringRedisTemplate redis;

	private final RateLimiter limiter;

	/** 시도 전에 호출. 잠겨 있으면 비밀번호를 확인하지 않고 바로 거부 */
	public void check(String account, String ip) {
		if (Boolean.TRUE.equals(redis.hasKey(lockKey(account)))) {
			throw new ApiException(ErrorCode.LOCKED);
		}
		String ipCount = redis.opsForValue().get(ipKey(ip));
		if (ipCount != null && Integer.parseInt(ipCount) >= IP_LIMIT) {
			throw new ApiException(ErrorCode.RATE_LIMITED);
		}
	}

	public void recordFailure(String account, String ip) {
		long count = limiter.increment(accountKey(account), WINDOW);
		if (count >= ACCOUNT_LIMIT) {
			redis.opsForValue().set(lockKey(account), "1", LOCK);
			limiter.reset(accountKey(account));
			log.warn("로그인 잠금(계정 {}회 실패) ip={}", ACCOUNT_LIMIT, ip);
		}
		long ipCount = limiter.increment(ipKey(ip), WINDOW);
		if (ipCount == IP_LIMIT) {
			log.warn("로그인 IP 제한 도달 ip={}", ip);
		}
	}

	public void recordSuccess(String account) {
		limiter.reset(accountKey(account));
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
