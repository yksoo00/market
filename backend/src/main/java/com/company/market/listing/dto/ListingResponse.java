package com.company.market.listing.dto;

import java.util.List;
import java.util.UUID;

public record ListingResponse(
		UUID userId,
		String regDate,
		String prodId,
		String prodName,
		String prodBrand,
		String prodNo,
		String prodSpecInfo,
		String tradeType,
		String prodState,
		Integer salesUnitPrice,
		Integer salesQuantity,
		Integer minOrderQuantity,
		Integer orderUnit,
		String deliveryDate,
		Integer stockQuantity,
		String description,
		String listingDataSheet,
		List<String> photos,
		Integer warrantyPeriod,
		String warrantyCoverage,
		String replaceProd,
		String testReport,
		String certificateOfAuthen,
		String dtUpdate,
		String dtExpire,
		String category,
		String mufcDate,
		String productDataSheet,
		String productPhoto,
		String tradeStatus,
		String warrantyUntil) {
}
