package com.company.market.trade.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 장바구니 담기 (스펙 2026-10-21). 수량·단가는 받지 않는다 — 나중에 견적·구매 모달에서. 구매자 id 는 인증 정보에서만 */
public record CartAddRequest(@NotNull @Size(min = 1, max = MAX_ADD) List<@Valid @NotNull Item> items) {

	public static final int MAX_ADD = 20;

	public record Item(@NotNull UUID sellerId, @NotBlank @Size(max = 14) String regDate) {
	}

}
