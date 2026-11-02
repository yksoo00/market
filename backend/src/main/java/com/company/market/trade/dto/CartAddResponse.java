package com.company.market.trade.dto;

/** 담기 결과: 지금 합계, 이번에 담은 줄 수. 같은 매물도 담을 때마다 새 줄이라 건너뛰는 일은 없다 (2026-11-02) */
public record CartAddResponse(long count, int added) {
}
