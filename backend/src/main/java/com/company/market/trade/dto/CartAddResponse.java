package com.company.market.trade.dto;

/** 담기 결과: 지금 합계, 새로 담은 수, 이미 담겨 있어 건너뛴 수 (처음 값 유지) */
public record CartAddResponse(long count, int added, int skipped) {
}
