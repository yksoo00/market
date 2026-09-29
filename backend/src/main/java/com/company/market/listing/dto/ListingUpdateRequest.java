package com.company.market.listing.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** 매물 부분수정(PATCH). null 필드는 그대로 둔다 — 상품마스터용 필드(카테고리·상품명 등)는 수정 대상이 아니다. */
public record ListingUpdateRequest(
		@Size(max = 20) String tradeType,
		@Size(max = 20) String prodState,
		@Min(0) @Max(1_000_000_000) Integer salesUnitPrice,
		@Min(1) @Max(100_000) Integer salesQuantity,
		@Min(1) Integer minOrderQuantity,
		@Min(1) Integer orderUnit,
		@Size(max = 10) String deliveryDate,
		@Min(0) Integer stockQuantity,
		@Size(max = 200) String description,
		@Size(max = 100) String listingDataSheet,
		@Size(max = 4) List<@Size(max = 100) String> photos,
		@Min(0) Integer warrantyPeriod,
		@Size(max = 10) String warrantyCoverage,
		@Size(max = 100) String replaceProd,
		@Size(max = 100) String testReport,
		@Size(max = 100) String certificateOfAuthen) {
}
