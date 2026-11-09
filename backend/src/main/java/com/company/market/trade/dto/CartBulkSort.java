package com.company.market.trade.dto;

import java.util.Locale;
import java.util.Map;

import com.company.market.common.exception.ValidationException;

/**
 * 조건을 통과한 매물 중 기본으로 고르는 기준 (계획 2026-11-09-bulk-purchase-conditions.md). 화면 위 선택지 하나가 모든 줄에 적용된다.
 * PRICE = 단가 낮은 순 → 보증 긴 순 → 상태 좋은 순, STATE = 상태 → 단가 → 보증, WARRANTY = 보증 → 단가 → 상태. 나머지는 모두 제공가능일 빠른 순 →
 * 재고 많은 순 → 등록일시 빠른 순
 */
public enum CartBulkSort {
	PRICE, STATE, WARRANTY;

	/** 요청 글자 → 정렬 기준. 비면 최저가 우선, 모르는 값은 400 */
	public static CartBulkSort parse(String raw) {
		if (raw == null || raw.isBlank()) {
			return PRICE;
		}
		try {
			return valueOf(raw.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException e) {
			throw new ValidationException(Map.of("sort", "정렬 기준은 price, state, warranty 중 하나여야 합니다."));
		}
	}
}
