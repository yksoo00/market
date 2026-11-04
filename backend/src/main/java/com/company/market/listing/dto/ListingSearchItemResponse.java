package com.company.market.listing.dto;

import java.util.UUID;

/** 검색 결과 한 줄. 프론트 ListingSearchItem(types/listing.ts)과 1:1 */
public record ListingSearchItemResponse(
		UUID userId,
		String regDate,
		String prodNo,
		String prodName,
		String prodBrand,
		String category,
		String prodDescription,
		boolean hasDataSheet,
		boolean hasPhoto,
		/** 대표 사진 저장소 키(첫 번째로 있는 사진). 없으면 null. 장바구니 카드가 보인다 (2026-11-03) */
		String mainPhoto,
		String warrantyUntil,
		String warrantyCoverage,
		boolean hasReplaceProd,
		boolean hasTestReport,
		boolean hasCertificate,
		String prodState,
		Integer stockQuantity,
		Integer salesUnitPrice,
		String deliveryDate,
		String tradeStatus,
		Integer minOrderQuantity,
		Integer orderUnit,
		/** "대 > 중 > 소" 이름. 카테고리 마스터에 없는 옛 코드면 null (화면은 category 코드를 보여 준다) */
		String categoryPath) {
}
