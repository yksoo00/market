package com.company.market.trade.dto;

import com.company.market.listing.dto.ListingCreateRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 수락된 견적에서 [구매]. 매물·단가는 그 견적 행과 지금 매물에서 정해지므로 받지 않는다 — 수량·납품희망일·요청사항만
 * (구매요청과 같은 규칙, 수치는 security.md "구매"). reqDeliDate 를 비우면 매물 납기일.
 */
public record QuotePurchaseRequest(
		@NotNull @Min(1) @Max(100_000) Integer orderQuantity,
		@Pattern(regexp = ListingCreateRequest.DELIVERY_DATE_PATTERN, message = TradeCreateRequest.REQ_DELI_DATE_MESSAGE) String reqDeliDate,
		@Size(max = 100) String remarks) {
}
