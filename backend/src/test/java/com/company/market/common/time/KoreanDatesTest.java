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
	@DisplayName("없는 날짜·글자 섞인 값·null 은 null, 숫자만·구분 문자 있는 형식은 모두 읽는다")
	void strictParse() {
		assertThat(KoreanDates.parseIso("2026-10-19")).isEqualTo(LocalDate.of(2026, 10, 19));
		assertThat(KoreanDates.parseIso("2026-02-30")).isNull();
		assertThat(KoreanDates.parseIso("20261019")).isEqualTo(LocalDate.of(2026, 10, 19));
		assertThat(KoreanDates.parseIso("2026-1019x")).isNull();
		assertThat(KoreanDates.parseIso(null)).isNull();
	}

	@Test
	@DisplayName("날짜는 구분 문자·앞뒤 공백이 있어도 yyyyMMdd 로 바꾼다")
	void normalizeDate() {
		for (String in : new String[] { "2026-10-10", "2026.10.10", "2026/10/10", " 2026-10-10 ", "20261010", "2026 10 10" }) {
			assertThat(KoreanDates.normalizeDate(in)).as(in).isEqualTo("20261010");
		}
	}

	@Test
	@DisplayName("날짜: 글자가 섞이거나 없는 날짜·자릿수 틀림·null 은 null")
	void normalizeDateRejects() {
		for (String in : new String[] { "2026-03-0a3", "2026-13-45", "2026-02-30", "26-10-10", "2026-10-100", "2026-1-111", "2026-10-1-0", "2 0 2 6 1 0 1 0", "", "  ", null }) {
			assertThat(KoreanDates.normalizeDate(in)).as(String.valueOf(in)).isNull();
		}
		assertThat(KoreanDates.normalizeDateOrKeep("2026-03-0a3")).isEqualTo("2026-03-0a3");
		assertThat(KoreanDates.normalizeDateOrKeep("2026-03-03")).isEqualTo("20260303");
	}

	@Test
	@DisplayName("일시는 8·12·14자리를 yyyyMMddHHmmss 로 맞춘다")
	void normalizeDateTime() {
		assertThat(KoreanDates.normalizeDateTime("2026-03-03 11:11:11")).isEqualTo("20260303111111");
		assertThat(KoreanDates.normalizeDateTime(" 2026-10-14 13:44")).isEqualTo("20261014134400");
		assertThat(KoreanDates.normalizeDateTime("2026-10-14")).isEqualTo("20261014000000");
		assertThat(KoreanDates.normalizeDateTime("20261014134455")).isEqualTo("20261014134455");
		assertThat(KoreanDates.normalizeDateTime("2026-10-14 25:00")).isNull();
		assertThat(KoreanDates.normalizeDateTime("2026-10-1a 13:44")).isNull();
		assertThat(KoreanDates.normalizeDateTime("2026-10")).isNull();
		assertThat(KoreanDates.normalizeDateTime(null)).isNull();
	}

}
