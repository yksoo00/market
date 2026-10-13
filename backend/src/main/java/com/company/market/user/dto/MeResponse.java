package com.company.market.user.dto;

import java.util.UUID;

import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;

/** 내 정보. 이름·이메일·휴대폰은 PII 라 넣지 않는다 (security.md "개인정보"). 화면 표시는 nickname 만 */
public record MeResponse(UUID id, UserKind kind, String nickname) {

	public static MeResponse from(User u) {
		return new MeResponse(u.getId(), u.getKind(), u.getNickname());
	}

}
