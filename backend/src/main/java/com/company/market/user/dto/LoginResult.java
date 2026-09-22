package com.company.market.user.dto;

import java.util.UUID;

/** 서비스 → 컨트롤러. 토큰은 쿠키로만 나가고 본문에는 userId 만 */
public record LoginResult(UUID userId, String accessToken, String refreshToken, boolean remember) {
}
