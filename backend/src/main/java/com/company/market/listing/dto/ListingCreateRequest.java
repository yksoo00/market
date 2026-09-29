package com.company.market.listing.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 매물 직접입력 등록. 상품마스터용 필드(categoryCode~productDataSheet)는 상품명+제조사로 찾거나 새로 만드는 데 쓰인다.
 * prodId 는 클라이언트가 지정하지 않는다(서버가 채번) — security.md "매물".
 */
public record ListingCreateRequest(
		@NotBlank @Size(max = 10) String categoryCode,
		@NotBlank @Size(max = 50) String prodName,
		@Size(max = 20) String prodNo,
		@NotBlank @Size(max = 50) String prodBrand,
		@Size(max = 14) String prodMufcDate,
		@Size(max = 100) String prodSpecInfo,
		@Size(max = 100) String productDataSheet,
		@NotBlank @Size(max = 20) String tradeType,
		@NotBlank @Size(max = 20) String prodState,
		@NotNull @Min(0) @Max(1_000_000_000) Integer salesUnitPrice,
		@NotNull @Min(1) @Max(100_000) Integer salesQuantity,
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
