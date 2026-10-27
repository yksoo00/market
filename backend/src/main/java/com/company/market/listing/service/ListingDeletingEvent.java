package com.company.market.listing.service;

import java.util.UUID;

/**
 * 매물 삭제 직전. 같은 트랜잭션 안에서 동기로 들린다 — 다른 도메인이 그 매물에 딸린 걸 정리하거나, 남은 거래가 있으면
 * 예외로 삭제를 막을 수 있게 (FK 가 없어 DB 가 막지 않는다, 2026-10-27)
 */
public record ListingDeletingEvent(UUID sellerId, String regDate, String prodId) {
}
