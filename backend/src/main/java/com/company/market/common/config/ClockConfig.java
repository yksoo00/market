package com.company.market.common.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** UTC 고정 시계. 운영·개발 PC의 시스템 기본 시간대가 달라 "지금 시각" 계산이 갈리는 것을 막는다 (backend.md "시간은 Instant(UTC)"). */
@Configuration
public class ClockConfig {

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}

}
