package com.company.market.common.time;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;

/**
 * 한국 날짜·시각과 날짜 문자열 파싱. 서버 Clock 은 UTC 라 그대로 쓰면 한국 오전 9시 전엔 하루 전 날짜가 된다 —
 * 한국 기준 "오늘"·"지금"이 필요하면 여기만 쓴다.
 */
public final class KoreanDates {

	public static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	/** STRICT 는 uuuu(연도) 와 함께 써야 2026-02-30 같은 날짜를 거부한다 (yyyy 는 연대 필드가 필요) */
	private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("uuuu-MM-dd").withResolverStyle(ResolverStyle.STRICT);

	private static final DateTimeFormatter COMPACT = DateTimeFormatter.ofPattern("uuuuMMdd").withResolverStyle(ResolverStyle.STRICT);

	private KoreanDates() {
	}

	public static LocalDate today(Clock clock) {
		return LocalDate.now(clock.withZone(SEOUL));
	}

	public static LocalDateTime now(Clock clock) {
		return LocalDateTime.now(clock.withZone(SEOUL));
	}

	/** yyyy-MM-dd. 없는 날짜·다른 형식·null 이면 null */
	public static LocalDate parseIso(String value) {
		return parse(value, ISO);
	}

	/** yyyyMMdd. 없는 날짜·다른 형식·null 이면 null */
	public static LocalDate parseCompact(String value) {
		return parse(value, COMPACT);
	}

	private static LocalDate parse(String value, DateTimeFormatter format) {
		if (value == null) {
			return null;
		}
		try {
			return LocalDate.parse(value, format);
		}
		catch (DateTimeParseException e) {
			return null;
		}
	}

}
