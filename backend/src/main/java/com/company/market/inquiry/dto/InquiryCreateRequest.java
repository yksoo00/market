package com.company.market.inquiry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 수치는 docs/security.md "입력 검증 > 문의 게시판" 과 프론트 lib/validation/inquiry.ts 와 같다 */
public record InquiryCreateRequest(
		@NotBlank(message = "제목을 입력하세요") @Size(max = 100, message = "제목은 100자 이하로 입력하세요") String title,
		@NotBlank(message = "내용을 입력하세요") @Size(max = 2000, message = "내용은 2000자 이하로 입력하세요") String content) {
}
