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
 * 장바구니 담기 (설계 2026-10-27 PR 3). 구매처럼 수량·납품희망일(필수)·요청사항을 받는다 — 단가는 등록단가로 고정.
 * 구매자 id 는 인증 정보에서만
 */
public record CartAddRequest(@NotNull @Size(min = 1, max = MAX_ADD) List<@Valid @NotNull Item> items) {

	public static final int MAX_ADD = 20;

	public record Item(
			@NotNull UUID sellerId,
			@NotBlank @Size(max = 14) String regDate,
			@NotNull @Min(1) @Max(100_000) Integer orderQuantity,
			@NotBlank(message = TradeCreateRequest.REQ_DELI_DATE_REQUIRED)
			@Pattern(regexp = ListingCreateRequest.DELIVERY_DATE_PATTERN, message = TradeCreateRequest.REQ_DELI_DATE_MESSAGE) String reqDeliDate,
			@Size(max = 100) String remarks) {

		public Item {
			reqDeliDate = com.company.market.common.time.KoreanDates.normalizeDateOrKeep(reqDeliDate);
		}
	}

}
