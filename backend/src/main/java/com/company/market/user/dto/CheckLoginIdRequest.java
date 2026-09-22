package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CheckLoginIdRequest(
		@NotBlank(message = "아이디를 입력하세요.")
		@Pattern(regexp = "^[a-z][a-z0-9]{4,19}$", message = "아이디는 영문 소문자로 시작하는 영문 소문자·숫자 5~20자입니다.") String loginId) {
}
