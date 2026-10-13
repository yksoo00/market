package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** 사업자번호만으로 조회 (사용자 지시, 2026-10-13). 개업일·대표자는 받지 않는다 */
public record BusinessVerifyRequest(
		@NotBlank(message = "사업자등록번호를 입력하세요.")
		@Pattern(regexp = "^\\d{10}$", message = "사업자등록번호는 숫자 10자리입니다.") String bizNo) {
}
