package com.company.market.trade.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** 장바구니 담은 수량 바꾸기 — 담기와 같은 상한 (규칙은 CartService 가 담기와 같게 본다) */
public record CartQuantityRequest(@NotNull @Min(1) @Max(100_000) Integer orderQuantity) {
}
