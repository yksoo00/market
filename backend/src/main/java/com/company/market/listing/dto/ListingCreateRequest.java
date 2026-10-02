package com.company.market.listing.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 매물 직접입력 등록. 상품마스터용 필드(categoryCode~productDataSheet)는 상품명+제조사로 찾거나 새로 만드는 데 쓰인다.
 * prodId 는 클라이언트가 지정하지 않는다(서버가 채번) — security.md "매물".
 * 보증기한·불량지원방법·대체품·테스트리포트·정품인증서는 등록 시점에 받지 않는다. 등록 후 필요한 사람만
 * PATCH(ListingUpdateRequest)로 추가한다.
 * 경로 필드(photos·데이터시트)는 /api/v1/uploads 가 돌려준 키 — 본인이 올린 것만 받는다 (UploadService.verifyOwned).
 */
public record ListingCreateRequest(
		@NotBlank @Size(max = 10) String categoryCode,
		@NotBlank @Size(max = 50) String prodName,
		@Size(max = 20) String prodNo,
		@NotBlank @Size(max = 50) String prodBrand,
		@Pattern(regexp = "^\\d{8}$", message = "제조일은 yyyyMMdd 형식이어야 합니다.") String prodMufcDate,
		@Size(max = 100) String prodSpecInfo,
		@Size(max = 100) String productDataSheet,
		@NotBlank @Size(max = 20) String tradeType,
		@NotBlank @Pattern(regexp = PROD_STATE_PATTERN, message = PROD_STATE_MESSAGE) String prodState,
		@NotNull @Min(0) @Max(1_000_000_000) Integer salesUnitPrice,
		@NotNull @Min(1) @Max(100_000) Integer salesQuantity,
		@Min(1) @Max(100_000) Integer minOrderQuantity,
		@Min(1) @Max(100_000) Integer orderUnit,
		@Pattern(regexp = DELIVERY_DATE_PATTERN, message = DELIVERY_DATE_MESSAGE) String deliveryDate,
		@Min(0) @Max(100_000) Integer stockQuantity,
		@Size(max = 200) String description,
		@Size(max = 100) String listingDataSheet,
		@Size(max = 4) List<@NotBlank @Size(max = 100) String> photos) {

	/** "신품" 또는 "신품대비 N%"(N = 1~99). 레거시 형식을 고정해 값이 제각각 쌓이지 않게 (security.md "매물") */
	public static final String PROD_STATE_PATTERN = "^(신품|신품대비 [1-9][0-9]?%)$";

	public static final String PROD_STATE_MESSAGE = "상품상태는 '신품' 또는 '신품대비 N%'(N은 1~99) 형식이어야 합니다.";

	public static final String DELIVERY_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

	public static final String DELIVERY_DATE_MESSAGE = "납기일은 YYYY-MM-DD 형식이어야 합니다.";

}
