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

	private KoreanDates() {
	}

	public static LocalDate today(Clock clock) {
		return LocalDate.now(clock.withZone(SEOUL));
	}

	public static LocalDateTime now(Clock clock) {
		return LocalDateTime.now(clock.withZone(SEOUL));
	}

	/** 날짜 칸 구분 문자. 이것만 지우고 글자가 섞이면 거절한다 — 글자까지 지우면 "2026-03-0a3" 이 엉뚱한 날짜로 조용히 저장된다 */
	private static final java.util.regex.Pattern SEPARATORS = java.util.regex.Pattern.compile("[\\s\\-./:T]");

	/** STRICT 는 uuuu(연도) 와 함께 써야 20260230 같은 날짜를 거부한다 (yyyy 는 연대 필드가 필요) */
	private static final DateTimeFormatter BASIC =DateTimeFormatter.ofPattern("uuuuMMdd").withResolverStyle(ResolverStyle.STRICT);

	private static final DateTimeFormatter BASIC_TIME = DateTimeFormatter.ofPattern("uuuuMMddHHmmss").withResolverStyle(ResolverStyle.STRICT);

	/**
	 * 날짜 입력을 저장 형식 yyyyMMdd 로. 구분 문자(공백 - . / : T)는 지우고 숫자 8자리여야 하며 실제 있는 날짜여야 한다.
	 * 2026-10-10, 2026.10.10, " 2026/10/10 ", 20261010 모두 20261010. 형식이 맞지 않으면 null
	 */
	public static String normalizeDate(String value) {
		if (value == null) {
			return null;
		}
		String digits = SEPARATORS.matcher(value).replaceAll("");
		if (digits.length() != 8 || !digits.chars().allMatch(Character::isDigit) || parse(digits, BASIC) == null) {
			return null;
		}
		return digits;
	}

	/** 요청 DTO 용: 올바른 날짜면 yyyyMMdd, 아니면 받은 값 그대로(뒤의 Bean Validation 이 형식 오류로 거절한다) */
	public static String normalizeDateOrKeep(String value) {
		String normalized = normalizeDate(value);
		return normalized != null ? normalized : value;
	}

	/**
	 * 일시 입력을 저장 형식 yyyyMMddHHmmss 로. 구분 문자는 지우고 숫자 8자리(날짜만 → 000000), 12자리(초 없음 → 00),
	 * 14자리를 받는다. 실제 있는 날짜·시각이어야 하고 형식이 맞지 않으면 null
	 */
	public static String normalizeDateTime(String value) {
		if (value == null) {
			return null;
		}
		String digits = SEPARATORS.matcher(value).replaceAll("");
		if (!digits.chars().allMatch(Character::isDigit)) {
			return null;
		}
		String full = switch (digits.length()) {
			case 8 -> digits + "000000";
			case 12 -> digits + "00";
			case 14 -> digits;
			default -> null;
		};
		if (full == null) {
			return null;
		}
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
