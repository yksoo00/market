package com.company.market.common.auth;

import java.util.UUID;

/** access 토큰에서 복원한 현재 사용자. 컨트롤러는 `@AuthenticationPrincipal AuthenticatedUser` 로만 받는다 */
public record AuthenticatedUser(UUID id) {
}
