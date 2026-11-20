package com.company.market.trade.dto;

import java.util.List;
import java.util.UUID;

import com.company.market.listing.dto.ListingCreateRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 견적 요청 (스펙 2026-10-20). 매물마다 희망단가·수량·납품희망일·비고. 납품희망일은 2026-10-27 부터 필수 (정의서 NOT NULL,
 * 화면 기본값은 제공가능일 — 전엔 받지 않았다).
 * 희망단가 상한(등록단가)·수량 규칙은 매물에 따라 달라 서비스가 본다. 구매자 id 는 인증 정보에서만.
 */
public record QuoteCreateRequest(@NotNull @Size(min = 1, max = MAX_ITEMS) List<@Valid @NotNull Item> items) {

	public static final int MAX_ITEMS = 20;

	public record Item(
			@NotNull UUID sellerId,
			@NotBlank @Size(max = 14) String regDate,
			@NotNull @Min(1) Integer orderUnitPrice,
			@NotNull @Min(1) @Max(100_000) Integer orderQuantity,
			@NotBlank(message = TradeCreateRequest.REQ_DELI_DATE_REQUIRED)
			@Pattern(regexp = ListingCreateRequest.DELIVERY_DATE_PATTERN, message = TradeCreateRequest.REQ_DELI_DATE_MESSAGE)
			String reqDeliDate,
			@Size(max = 100) String remarks,
			// 장바구니에서 누른 견적이면 그 줄의 거래ID — 있으면 그 줄이 견적요청이 된다 (2026-11-02)
			@Size(max = 20) String cartTradeId) {

		public Item {
			reqDeliDate = com.company.market.common.time.KoreanDates.normalizeDateOrKeep(reqDeliDate);
		}

		public Item(UUID sellerId, String regDate, Integer orderUnitPrice, Integer orderQuantity, String reqDeliDate, String remarks) {
			this(sellerId, regDate, orderUnitPrice, orderQuantity, reqDeliDate, remarks, null);
		}
	}

}
