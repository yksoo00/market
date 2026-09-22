package com.company.market.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CheckNicknameRequest(
		@NotBlank(message = "닉네임을 입력하세요.") @Size(min = 2, max = 20, message = "닉네임은 2~20자입니다.") String nickname) {
}
