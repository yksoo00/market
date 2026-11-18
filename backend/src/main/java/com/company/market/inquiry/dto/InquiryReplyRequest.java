package com.company.market.inquiry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InquiryReplyRequest(
		@NotBlank(message = "답글을 입력하세요") @Size(max = 1000, message = "답글은 1000자 이하로 입력하세요") String content) {
}
