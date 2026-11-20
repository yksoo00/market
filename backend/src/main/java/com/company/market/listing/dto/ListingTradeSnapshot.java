package com.company.market.listing.dto;

import java.util.UUID;

import com.company.market.listing.domain.ListingId;

/**
 * 거래(trade 도메인)가 구매요청 때 복사해 가는 매물 값. 도메인 간은 service 로만 오가므로 엔티티 대신 이 record.
 * photo 는 공개 대표 사진 키만 (비공개 파일 키는 담지 않는다).
 */
public record ListingTradeSnapshot(
		String sellerId,
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
		String photo,
		/** 장바구니·비교 행에 복사하는 상품마스터 값 (trd_cart_info) */
		String manufacturer,
		String prodSpecInfo,
		/** 상품마스터 대-중-소 경로 코드 — 비교는 이 값이 같은 매물끼리만 */
		String categoryCode) {

	/** 이 매물의 PK — 거래 행이 매물을 다시 찾을 때 쓰는 세 값 */
	public ListingId id() {
		return new ListingId(sellerId, regDate, prodId);
	}

}
