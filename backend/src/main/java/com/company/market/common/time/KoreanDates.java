package com.company.market.common.time;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 한국 날짜·시각과 날짜 문자열 파싱. 서버 Clock 은 UTC 라 그대로 쓰면 한국 오전 9시 전엔 하루 전 날짜가 된다 —
 * 한국 기준 "오늘"·"지금"이 필요하면 여기만 쓴다.
 */
public final class KoreanDates {

	public static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private KoreanDates() {
	}

	public static LocalDate today(Clock clock) {
		return LocalDate.now(clock.withZone(SEOUL));
	}

	public static LocalDateTime now(Clock clock) {
		return LocalDateTime.now(clock.withZone(SEOUL));
	}

	/**
	 * 날짜 모양: 연 4자리·월 2자리·일 2자리, 사이에 구분 문자(공백 - . /) 하나가 있어도 없어도 된다. 구분 문자를 아무 데서나 지우지
	 * 않고 자리를 고정한다 — "2026-1-111" 이 20261111 로, "2026-03-0a3" 이 엉뚱한 날짜로 조용히 저장되지 않게
	 */
	private static final Pattern DATE_SHAPE = Pattern.compile("^\\s*(\\d{4})[-./\\s]?(\\d{2})[-./\\s]?(\\d{2})\\s*$");

	/** 일시 모양: 날짜 모양 뒤에 선택으로 시:분 또는 시:분:초 (앞에 공백 또는 T, 콜론은 있어도 없어도) */
	private static final Pattern DATETIME_SHAPE = Pattern
		.compile("^\\s*(\\d{4})[-./\\s]?(\\d{2})[-./\\s]?(\\d{2})(?:[\\sT]?(\\d{2}):?(\\d{2})(?::?(\\d{2}))?)?\\s*$");

	/** STRICT 는 uuuu(연도) 와 함께 써야 20260230 같은 날짜를 거부한다 (yyyy 는 연대 필드가 필요) */
	private static final DateTimeFormatter BASIC = DateTimeFormatter.ofPattern("uuuuMMdd").withResolverStyle(ResolverStyle.STRICT);

	private static final DateTimeFormatter BASIC_TIME = DateTimeFormatter.ofPattern("uuuuMMddHHmmss").withResolverStyle(ResolverStyle.STRICT);

	/**
	 * 날짜 입력을 저장 형식 yyyyMMdd 로. 2026-10-10, 2026.10.10, " 2026/10/10 ", 20261010 모두 20261010.
	 * 모양(DATE_SHAPE)이 맞고 실제 있는 날짜여야 하며 아니면 null
	 */
	public static String normalizeDate(String value) {
		if (value == null) {
			return null;
		}
		Matcher m = DATE_SHAPE.matcher(value);
		if (!m.matches()) {
			return null;
		}
		String digits = m.group(1) + m.group(2) + m.group(3);
		return parse(digits, BASIC) == null ? null : digits;
	}

	/** 요청 DTO 용: 올바른 날짜면 yyyyMMdd, 아니면 받은 값 그대로(뒤의 Bean Validation 이 형식 오류로 거절한다) */
	public static String normalizeDateOrKeep(String value) {
		String normalized = normalizeDate(value);
		return normalized != null ? normalized : value;
	}

	/**
	 * 일시 입력을 저장 형식 yyyyMMddHHmmss 로. 날짜만이면 000000, 시:분이면 초 00 을 붙인다.
	 * 모양(DATETIME_SHAPE)이 맞고 실제 있는 날짜·시각이어야 하며 아니면 null
	 */
	public static String normalizeDateTime(String value) {
		if (value == null) {
			return null;
		}
		Matcher m = DATETIME_SHAPE.matcher(value);
		if (!m.matches()) {
			return null;
		}
		String full = m.group(1) + m.group(2) + m.group(3) + (m.group(4) == null ? "0000" : m.group(4) + m.group(5))
				+ (m.group(6) == null ? "00" : m.group(6));
		try {
			LocalDateTime.parse(full, BASIC_TIME);
			return full;
		}
		catch (DateTimeParseException e) {
			return null;
		}
	}

	/** 날짜 입력(yyyyMMdd, yyyy-MM-dd 등 normalizeDate 가 받는 형식) → LocalDate. 없는 날짜·다른 형식·null 이면 null */
	public static LocalDate parseIso(String value) {
		String normalized = normalizeDate(value);
		return normalized == null ? null : parse(normalized, BASIC);
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
