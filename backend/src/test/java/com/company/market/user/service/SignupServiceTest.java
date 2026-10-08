package com.company.market.user.service;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import com.company.market.common.config.AppProperties;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.user.dto.BusinessVerifyRequest;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SignupServiceTest {

	@Mock
	UserRepository users;

	@Mock
	PasswordEncoder passwordEncoder;

	@Mock
	RateLimiter limiter;

	@Mock
	AppProperties props;

	@Mock
	TransactionTemplate tx;

	@Mock(answer = Answers.RETURNS_DEEP_STUBS)
	StringRedisTemplate redis;

	@Test
	@DisplayName("개업년월일은 한국 날짜 기준: UTC 16:00(한국 다음 날 01:00)에 한국 어제는 통과, 한국 오늘은 거부")
	void businessStartDateUsesSeoulToday() {
		Clock clock = Clock.fixed(Instant.parse("2026-10-07T16:00:00Z"), ZoneOffset.UTC);
		SignupService service = new SignupService(users, passwordEncoder, limiter, props, tx, redis, clock);
		when(props.isLocal()).thenReturn(true);
		when(users.findByBusRegIdAndDeletedAtIsNull("1234567890")).thenReturn(Optional.empty());

		assertThat(service.verifyBusiness(new BusinessVerifyRequest("1234567890", "20261007", "홍길동"), "127.0.0.1")).isNotBlank();

		assertThatThrownBy(() -> service.verifyBusiness(new BusinessVerifyRequest("1234567890", "20261008", "홍길동"), "127.0.0.1"))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("startDate"));
	}

}
