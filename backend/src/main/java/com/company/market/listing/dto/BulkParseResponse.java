package com.company.market.listing.dto;

import java.util.List;

/** 업로드한 엑셀을 읽은 줄과 줄별 검사 결과 (rows[i] 와 results[i] 가 같은 줄) */
public record BulkParseResponse(List<BulkRowDto> rows, List<BulkRowResult> results) {
}
