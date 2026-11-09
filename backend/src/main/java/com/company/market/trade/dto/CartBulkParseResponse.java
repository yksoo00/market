package com.company.market.trade.dto;

import java.util.List;

/** 업로드한 엑셀을 읽은 줄과 줄별 검사 결과 (rows[i] 와 results[i] 가 같은 줄) + 지금 장바구니 줄 수·한도 */
public record CartBulkParseResponse(List<CartBulkRowDto> rows, List<CartBulkRowResult> results, long cartCount, int cartMax) {
}
