package com.company.market.user.service;

import java.util.Optional;

import com.company.market.user.domain.VerificationProvider;

/**
 * 가입 전 본인인증 결과 조회. 토큰 → 인증된 이름·휴대폰·CI·DI.
 * 구현 선택은 `app.identity-verification.provider` (IdentityVerifierConfig). stub 은 개발용, 운영은 PASS/NICE.
 */
public interface IdentityVerifier {

	/**
	 * @param token 프론트가 인증 단계에서 받은 토큰
	 * @param enteredName 사용자가 정보입력 단계에 쓴 이름 (실제 업체 연동 시 인증 결과와 대조)
	 * @param enteredPhone 숫자만
	 * @return 없음·만료·불일치면 empty (호출자는 VERIFICATION_EXPIRED)
	 */
	Optional<VerifiedIdentity> resolve(String token, String enteredName, String enteredPhone);

	record VerifiedIdentity(String name, String phone, String ci, String di, VerificationProvider provider) {
	}

}
