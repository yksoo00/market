package com.company.market.trade.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 견적 요청 (스펙 2026-10-20). 매물마다 희망단가·수량·비고. 납품희망일은 받지 않는다(사용자 결정).
 * 희망단가 상한(등록단가)·수량 규칙은 매물에 따라 달라 서비스가 본다. 구매자 id 는 인증 정보에서만.
 */
public record QuoteCreateRequest(@NotNull @Size(min = 1, max = MAX_ITEMS) List<@Valid @NotNull Item> items) {

	public static final int MAX_ITEMS = 20;

	public record Item(
			@NotNull UUID sellerId,
			@NotBlank @Size(max = 14) String regDate,
			@NotNull @Min(1) Integer orderUnitPrice,
			@NotNull @Min(1) @Max(100_000) Integer orderQuantity,
			@Size(max = 100) String remarks) {
	}

}
