package com.company.market.listing.dto;

import java.util.UUID;

/**
 * 거래(trade 도메인)가 구매요청 때 복사해 가는 매물 값. 도메인 간은 service 로만 오가므로 엔티티 대신 이 record.
 * photo 는 공개 대표 사진 키만 (비공개 파일 키는 담지 않는다).
 */
public record ListingTradeSnapshot(
		UUID sellerId,
		String regDate,
		String prodId,
		String prodName,
		String prodState,
		Integer salesUnitPrice,
		Integer stockQuantity,
		Integer minOrderQuantity,
		Integer orderUnit,
		String provDate,
		boolean completed,
		String photo) {
}
