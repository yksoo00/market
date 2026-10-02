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
		String mufcDate,
		String prodDescription,
		boolean hasDataSheet,
		boolean hasPhoto,
		String warrantyUntil,
		String warrantyCoverage,
		boolean hasReplaceProd,
		boolean hasTestReport,
		boolean hasCertificate,
		String prodState,
		Integer stockQuantity,
		Integer salesUnitPrice,
		String deliveryDate,
		String tradeStatus) {
}
