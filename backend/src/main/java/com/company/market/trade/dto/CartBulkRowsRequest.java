package com.company.market.trade.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 대량구매 검사·담기 요청. 상한 100 은 CartBulkParser.MAX_ROWS(= 장바구니 최대 줄 수)와 같은 값. sort 는 CartBulkSort (price|state|warranty, 비우면 price) */
public record CartBulkRowsRequest(@NotNull @Size(min = 1, max = 100) List<@Valid @NotNull CartBulkRowDto> rows, @Size(max = 20) String sort) {
}
