package com.company.market.inquiry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 수치는 docs/security.md "입력 검증 > 문의 게시판" 과 프론트 lib/validation/inquiry.ts 와 같다.
 * 빈 값 판정은 프론트 JS trim() 과 같게 NBSP·BOM 도 공백으로 본다(@NotBlank 는 Character.isWhitespace 라 이 둘을 못 거른다).
 * NUL(U+0000)은 Postgres varchar 에 저장할 수 없어 막지 않으면 500 이 된다.
 */
public record InquiryCreateRequest(
		@NotBlank(message = "제목을 입력하세요") @Pattern(regexp = InquiryText.VISIBLE, message = "제목을 입력하세요")
		@Pattern(regexp = InquiryText.NO_NUL, message = InquiryText.NUL_MESSAGE) @Size(max = 100, message = "제목은 100자 이하로 입력하세요") String title,
		@NotBlank(message = "내용을 입력하세요") @Pattern(regexp = InquiryText.VISIBLE, message = "내용을 입력하세요")
		@Pattern(regexp = InquiryText.NO_NUL, message = InquiryText.NUL_MESSAGE) @Size(max = 2000, message = "내용은 2000자 이하로 입력하세요") String content) {
}
