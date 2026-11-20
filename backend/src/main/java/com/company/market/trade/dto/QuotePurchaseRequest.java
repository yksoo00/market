package com.company.market.trade.dto;

import com.company.market.listing.dto.ListingCreateRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 수락된 견적에서 [구매]. 매물·단가는 그 견적 행과 지금 매물에서 정해지므로 받지 않는다 — 수량·납품희망일·요청사항만
 * (구매요청과 같은 규칙, 수치는 security.md "구매"). 납품희망일 필수 (2026-10-27).
 */
public record QuotePurchaseRequest(
		@NotNull @Min(1) @Max(100_000) Integer orderQuantity,
		@NotBlank(message = TradeCreateRequest.REQ_DELI_DATE_REQUIRED)
		@Pattern(regexp = ListingCreateRequest.DELIVERY_DATE_PATTERN, message = TradeCreateRequest.REQ_DELI_DATE_MESSAGE) String reqDeliDate,
		@Size(max = 100) String remarks) {

	public QuotePurchaseRequest {
		reqDeliDate = com.company.market.common.time.KoreanDates.normalizeDateOrKeep(reqDeliDate);
	}
}
