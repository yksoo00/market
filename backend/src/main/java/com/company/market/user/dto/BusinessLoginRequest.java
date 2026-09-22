package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record BusinessLoginRequest(
		@NotBlank(message = "사업자등록번호를 입력하세요.") @Pattern(regexp = "^\\d{10}$", message = "사업자등록번호는 숫자 10자리입니다.") String bizNo,
		@NotBlank(message = "비밀번호를 입력하세요.") @Size(max = 32, message = "비밀번호는 32자 이하입니다.") String password,
		boolean remember) {
}
