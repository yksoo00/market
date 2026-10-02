package com.company.market.listing.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 매물 부분수정(PATCH). null 필드는 그대로 둔다 — 상품마스터용 필드(카테고리·상품명 등)는 수정 대상이 아니다.
 * tradeType·prodState는 NOT NULL 컬럼이라 "보냈다면" 공백만으로는 안 된다(null은 여전히 허용 — 미수정).
 * 경로 필드(photos·데이터시트·테스트리포트·정품인증서·대체품)는 /api/v1/uploads 가 돌려준 키, 또는 이 매물에 이미 저장된 키.
 */
public record ListingUpdateRequest(
		@Pattern(regexp = ".*\\S.*", message = "거래종류는 빈 값일 수 없습니다.") @Size(max = 20) String tradeType,
		@Pattern(regexp = ".*\\S.*", message = "상품상태는 빈 값일 수 없습니다.") @Size(max = 20) String prodState,
		@Min(0) @Max(1_000_000_000) Integer salesUnitPrice,
		@Min(1) @Max(100_000) Integer salesQuantity,
		@Min(1) @Max(100_000) Integer minOrderQuantity,
		@Min(1) @Max(100_000) Integer orderUnit,
		@Size(max = 10) String deliveryDate,
		@Min(0) @Max(100_000) Integer stockQuantity,
		@Size(max = 200) String description,
		@Size(max = 100) String listingDataSheet,
		@Size(max = 4) List<@NotBlank @Size(max = 100) String> photos,
		@Min(0) @Max(36_500) Integer warrantyPeriod,
		@Size(max = 10) String warrantyCoverage,
		@Size(max = 100) String replaceProd,
		@Size(max = 100) String testReport,
		@Size(max = 100) String certificateOfAuthen) {
}
