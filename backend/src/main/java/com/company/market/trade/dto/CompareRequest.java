package com.company.market.trade.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 비교 — 내 비교 목록에 더하거나(POST) 이 매물들로 바꾼다(PUT, 사용자 결정 2026-10-29·2026-11-03). 1~4개·같은 소분류는 서비스가
 * COMPARE_COUNT·COMPARE_FULL·COMPARE_CATEGORY_MISMATCH 로 판정한다 (DTO 는 터무니없는 크기만 막는다). 구매자 id 는 인증 정보에서만
 */
public record CompareRequest(@NotNull @Size(min = 1, max = 20) List<@Valid @NotNull Item> items) {

	public record Item(@NotBlank @Size(max = 11) String sellerId, @NotBlank @Size(max = 14) String regDate) {
	}

}
