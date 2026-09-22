package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 소셜 가입 마무리. 이름·휴대폰 없음 — 소셜 회원은 본인인증을 하지 않는다 (decisions.md 2026-09-21) */
public record SocialSignupRequest(
		@NotBlank(message = "로그인 정보가 없습니다.") String token,
		@NotBlank(message = "닉네임을 입력하세요.") @Size(min = 2, max = 20, message = "닉네임은 2~20자입니다.") String nickname,
		@NotNull(message = "마케팅 수신 동의 여부가 필요합니다.") Boolean marketingOptIn) {
}
