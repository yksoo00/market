package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record BusinessVerifyRequest(
		@NotBlank(message = "사업자등록번호를 입력하세요.")
		@Pattern(regexp = "^\\d{10}$", message = "사업자등록번호는 숫자 10자리입니다.") String bizNo,
		@NotBlank(message = "개업년월일을 입력하세요.")
		@Pattern(regexp = "^\\d{8}$", message = "개업년월일은 YYYYMMDD 8자리입니다.") String startDate,
		@NotBlank(message = "대표자 성명을 입력하세요.") @Size(min = 2, max = 50, message = "대표자 성명은 2~50자입니다.") String ownerName) {
}
