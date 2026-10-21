package com.company.market.listing.service;

import java.util.UUID;

/** 매물 삭제 직전. 같은 트랜잭션 안에서 동기로 들린다 — 다른 도메인이 그 매물에 딸린 걸 정리할 수 있게 */
public record ListingDeletingEvent(UUID sellerId, String regDate) {
}
