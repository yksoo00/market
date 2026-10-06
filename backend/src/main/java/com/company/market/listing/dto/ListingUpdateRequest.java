package com.company.market.listing.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 매물 부분수정(PATCH). null 필드는 그대로 둔다. 상품마스터 칸(카테고리·상품명 등)은 ListingService 의 상품 칸 규칙을 따른다.
 * tradeType·prodState는 NOT NULL 컬럼이라 "보냈다면" 공백만으로는 안 된다(null은 여전히 허용 — 미수정).
 * 경로 필드(photos·데이터시트·테스트리포트·정품인증서·대체품)는 /api/v1/uploads 가 돌려준 키, 또는 이 매물에 이미 저장된 키.
 */
public record ListingUpdateRequest(
		@Pattern(regexp = ".*\\S.*", message = "거래종류는 빈 값일 수 없습니다.") @Size(max = 20) String tradeType,
		@Pattern(regexp = ListingCreateRequest.PROD_STATE_PATTERN, message = ListingCreateRequest.PROD_STATE_MESSAGE) String prodState,
		@Min(0) @Max(1_000_000_000) Integer salesUnitPrice,
		@Min(1) @Max(100_000) Integer salesQuantity,
		@Min(1) @Max(100_000) Integer minOrderQuantity,
		@Min(1) @Max(100_000) Integer orderUnit,
		@Pattern(regexp = ListingCreateRequest.DELIVERY_DATE_PATTERN, message = ListingCreateRequest.DELIVERY_DATE_MESSAGE) String deliveryDate,
		@Min(0) @Max(100_000) Integer stockQuantity,
		@Size(max = 200) String description,
		@Size(max = 100) String listingDataSheet,
		@Size(max = 4) List<@NotBlank @Size(max = 100) String> photos,
		@Min(0) @Max(36_500) Integer warrantyPeriod,
		@Size(max = 10) String warrantyCoverage,
		@Size(max = 100) String replaceProd,
		@Size(max = 100) String testReport,
		@Size(max = 100) String certificateOfAuthen,
		// 상품 칸 (2026-10-06 내 판매글 행 안 수정). 이름·제조사가 바뀌면 이 매물만 다른 상품으로, 나머지는 단독 사용일 때만 상품마스터를 고친다.
		// null = 그대로, 번호·제조일·사양은 "" = 비우기. 이름·제조사·카테고리는 보냈다면 비울 수 없다
		@Pattern(regexp = ".*\\S.*", message = "카테고리는 빈 값일 수 없습니다.") @Size(max = 10) String categoryCode,
		@Pattern(regexp = ".*\\S.*", message = "상품명은 빈 값일 수 없습니다.") @Size(max = 50) String prodName,
		@Pattern(regexp = ".*\\S.*", message = "제조사는 빈 값일 수 없습니다.") @Size(max = 50) String prodBrand,
		@Size(max = 20) String prodNo,
		@Pattern(regexp = "^(\\d{8})?$", message = "제조일은 yyyyMMdd 형식이어야 합니다.") String prodMufcDate,
		@Size(max = 100) String prodSpecInfo) {

	public boolean hasProductFields() {
		return categoryCode != null || prodName != null || prodBrand != null || prodNo != null || prodMufcDate != null
				|| prodSpecInfo != null;
	}
}
