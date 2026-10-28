package com.company.market.listing.domain;

import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 상품마스터의 카테고리 조각(대·중·소, 예: P01·Q01·R001). 화면·API 는 세 조각을 '-' 로 이은 경로 코드(P01-Q01-R001)를 쓴다.
 * 조각의 이름·부모 관계는 trd_ctgr_master (2026-10-27 설계 PR 2)
 */
public record CategoryFragments(String major, String middle, String minor) {

	/** null 이 아닌 조각을 '-' 로 이은 경로. 다 없으면 null */
	/** 경로 코드를 조각으로 (모자란 조각은 null). 있는 코드인지는 보지 않는다 — CategoryService.resolveMinor */
	public static CategoryFragments parse(String code) {
		String[] parts = code.trim().split("-", -1);
		return new CategoryFragments(part(parts, 0), part(parts, 1), part(parts, 2));
	}

	private static String part(String[] parts, int index) {
		return index < parts.length && !parts[index].isEmpty() ? parts[index] : null;
	}

	public String code() {
		String code = Stream.of(major, middle, minor).filter(Objects::nonNull).collect(Collectors.joining("-"));
		return code.isEmpty() ? null : code;
	}

}
