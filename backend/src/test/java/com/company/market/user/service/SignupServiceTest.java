package com.company.market.user.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import com.company.market.common.config.AppProperties;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.user.dto.BusinessVerifyRequest;
import com.company.market.user.dto.SignupBusinessRequest;
import com.company.market.user.dto.SignupPersonalRequest;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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

	SignupService service() {
		return new SignupService(users, passwordEncoder, limiter, props, tx, redis, Clock.fixed(Instant.parse("2026-10-13T00:00:00Z"), ZoneOffset.UTC));
	}

	@Test
	@DisplayName("사업자번호 조회는 번호만 받아 토큰에 번호만 담는다")
	void verifyStoresBizNoOnly() {
		when(props.isLocal()).thenReturn(true);
		when(users.findByBusRegId("1234567890")).thenReturn(Optional.empty());

		String token = service().verifyBusiness(new BusinessVerifyRequest("1234567890"), "127.0.0.1");

		verify(redis.opsForValue()).set(eq("signup:biz:" + token), eq("1234567890"), any(Duration.class));
	}

	@Test
	@DisplayName("기업 가입이 검증에서 거부되면 조회 토큰을 지우지 않는다 — 고쳐서 다시 제출할 수 있게")
	void rejectedSubmitKeepsToken() {
		when(redis.opsForValue().get("signup:biz:t1")).thenReturn("1234567890");
		SignupBusinessRequest req = new SignupBusinessRequest("t1", "acme01", "acme01-Pass!", "corporation", "테스트상사", "20200101", "서울",
				"김담당", "01055556666", "owner@biz.example", "", "1", true, true);

		assertThatThrownBy(() -> service().signupBusiness(req, "127.0.0.1"))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("password"));
		verify(redis, never()).delete(anyString());
	}

	@Test
	@DisplayName("개업년월일은 한국 날짜 기준: UTC 16:00(한국 다음 날 01:00)에 한국 오늘은 거부")
	void openDateUsesSeoulToday() {
		SignupService service = new SignupService(users, passwordEncoder, limiter, props, tx, redis, Clock.fixed(Instant.parse("2026-10-07T16:00:00Z"), ZoneOffset.UTC));
		when(redis.opsForValue().get("signup:biz:t1")).thenReturn("1234567890");
		SignupBusinessRequest today = new SignupBusinessRequest("t1", "acme01", "Str0ng-pass!", "corporation", "테스트상사", "20261008", "서울",
				"김담당", "01055556666", "owner@biz.example", "", "1", true, true);

		assertThatThrownBy(() -> service.signupBusiness(today, "127.0.0.1"))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("startDate"));
	}

	@Test
	@DisplayName("동시 가입으로 이메일 유일 인덱스(ux_trd_user_info_email)가 터지면 DUPLICATE_EMAIL 로 바꾼다")
	void concurrentDuplicateEmailMapsToConflict() {
		when(passwordEncoder.encode(anyString())).thenReturn("hash");
		when(tx.execute(any())).thenThrow(new DataIntegrityViolationException("저장 실패",
				new RuntimeException("duplicate key value violates unique constraint \"ux_trd_user_info_email\"")));
		SignupPersonalRequest req = new SignupPersonalRequest("홍길동", "길동이", "Y", "gildong1", "a@example.com", "Abcdefg-1234", "01012345678",
				"서울", "1", true, true);

		assertThatThrownBy(() -> service().signupPersonal(req, "127.0.0.1"))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(ErrorCode.DUPLICATE_EMAIL));
	}

}
