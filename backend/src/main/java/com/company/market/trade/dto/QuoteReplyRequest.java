package com.company.market.trade.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 받은 견적요청 한꺼번에 수락·거절 — 한 번에 30건까지(목록이 30건까지만 주므로) */
public record QuoteReplyRequest(
		@NotNull @Size(min = 1, max = QuoteReplyRequest.MAX) List<@NotBlank @Size(max = 20) String> tradeIds,
		@NotNull @Pattern(regexp = "accept|reject", message = "decision 은 accept 또는 reject 입니다.") String decision) {

	public static final int MAX = 30;

	public boolean accept() {
		return "accept".equals(decision);
	}

}
