package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 형식 검증은 최소로 — 로그인에서 규칙을 자세히 알려주면 계정 탐색을 돕는다. 규칙 검사는 가입 DTO 에서 */
public record LoginRequest(
		@NotBlank(message = "아이디를 입력하세요.") @Size(max = 20, message = "아이디는 20자 이하입니다.") String loginId,
		@NotBlank(message = "비밀번호를 입력하세요.") @Size(max = 32, message = "비밀번호는 32자 이하입니다.") String password,
		boolean remember) {
}
