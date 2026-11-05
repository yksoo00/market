package com.company.market.listing.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 다량 등록 검사·확정 요청. 상한 200 은 ListingBulkParser.MAX_ROWS 와 같은 값 */
public record BulkRowsRequest(@NotNull @Size(min = 1, max = 200) List<@Valid @NotNull BulkRowDto> rows) {
}
