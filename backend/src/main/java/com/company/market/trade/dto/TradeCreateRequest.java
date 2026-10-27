package com.company.market.trade.dto;

import java.util.UUID;

import com.company.market.listing.dto.ListingCreateRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 구매요청. 매물은 (sellerId, regDate). 단가는 받지 않는다 — 등록단가로 고정 (사용자 결정 2026-10-15).
 * 납품희망일은 필수 (정의서 NOT NULL, 2026-10-27 — 화면 기본값은 제공가능일). 구매자 id 는 인증 정보에서만.
 */
public record TradeCreateRequest(
		@NotNull UUID sellerId,
		@NotBlank @Size(max = 14) String regDate,
		@NotNull @Min(1) @Max(100_000) Integer orderQuantity,
		@NotBlank(message = REQ_DELI_DATE_REQUIRED)
		@Pattern(regexp = ListingCreateRequest.DELIVERY_DATE_PATTERN, message = REQ_DELI_DATE_MESSAGE) String reqDeliDate,
		@Size(max = 100) String remarks) {

	public static final String REQ_DELI_DATE_MESSAGE = "납품희망일은 YYYY-MM-DD 형식이어야 합니다.";

	public static final String REQ_DELI_DATE_REQUIRED = "납품희망일을 입력해 주세요.";

}
