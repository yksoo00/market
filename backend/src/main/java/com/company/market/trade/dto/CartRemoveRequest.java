package com.company.market.trade.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 장바구니 빼기 — 한 번에 장바구니 전체(100)까지 */
public record CartRemoveRequest(@NotNull @Size(min = 1, max = 100) List<@NotBlank @Size(max = 20) String> tradeIds) {
}
