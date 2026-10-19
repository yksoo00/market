package com.company.market.common.time;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class KoreanDatesTest {

	@Test
	@DisplayName("UTC 15:30 은 한국 다음 날 0시")
	void todayIsSeoulDate() {
		Clock c = Clock.fixed(Instant.parse("2026-10-18T15:30:00Z"), ZoneOffset.UTC);
		assertThat(KoreanDates.today(c)).isEqualTo(LocalDate.of(2026, 10, 19));
		assertThat(KoreanDates.now(c).getHour()).isEqualTo(0);
	}

	@Test
	@DisplayName("없는 날짜·다른 형식·null 은 null")
	void strictParse() {
		assertThat(KoreanDates.parseIso("2026-10-19")).isEqualTo(LocalDate.of(2026, 10, 19));
		assertThat(KoreanDates.parseIso("2026-02-30")).isNull();
		assertThat(KoreanDates.parseIso("20261019")).isNull();
		assertThat(KoreanDates.parseIso(null)).isNull();
		assertThat(KoreanDates.parseCompact("20261019")).isEqualTo(LocalDate.of(2026, 10, 19));
		assertThat(KoreanDates.parseCompact("20260230")).isNull();
		assertThat(KoreanDates.parseCompact("2026-10-19")).isNull();
	}

}
