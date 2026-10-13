package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 기업도 아이디·비밀번호로 로그인 (2026-10-13). 사업자번호 로그인 시절 계정은 사업자번호가 곧 아이디라 그대로 된다 */
public record BusinessLoginRequest(
		@NotBlank(message = "아이디를 입력하세요.") @Size(max = 20, message = "아이디는 20자 이하입니다.") String loginId,
		@NotBlank(message = "비밀번호를 입력하세요.") @Size(max = 32, message = "비밀번호는 32자 이하입니다.") String password,
		boolean remember) {
}
