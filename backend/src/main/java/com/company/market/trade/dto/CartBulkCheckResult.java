package com.company.market.trade.dto;

import java.util.List;

/** 줄별 검사 결과 + 지금 장바구니 줄 수·한도(화면이 "장바구니 N/100"을 보이게) */
public record CartBulkCheckResult(List<CartBulkRowResult> results, long cartCount, int cartMax) {
}
