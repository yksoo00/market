package com.company.market.user.service;

import java.util.Optional;

import com.company.market.common.crypto.PiiHasher;
import com.company.market.user.domain.VerificationProvider;

/**
 * 개발용 본인인증. 프론트 `IdentityVerifyButton` 이 보내는 고정 토큰만 받아 사용자가 입력한 이름·휴대폰을 그대로 "인증된 값"으로
 * 친다. CI 는 휴대폰에서 파생시켜 "한 사람 = 계정 하나"(ci_hash 유일)를 휴대폰 기준으로 흉내낸다.
 * 운영에서는 IdentityVerifierConfig 가 이 클래스를 만들지 않으므로 stub 토큰이 거부된다.
 * TODO(PASS/NICE 계약 후): Redis `signup:verify:{token}` 을 읽는 구현으로 교체 (data-model.md "Redis 키"). 그때 이 파일 삭제.
 */
class StubIdentityVerifier implements IdentityVerifier {

	static final String TOKEN = "stub-verification-token";

	private final PiiHasher hasher;

	StubIdentityVerifier(PiiHasher hasher) {
		this.hasher = hasher;
	}

	@Override
	public Optional<VerifiedIdentity> resolve(String token, String enteredName, String enteredPhone) {
		if (!TOKEN.equals(token)) {
			return Optional.empty();
		}
		return Optional.of(new VerifiedIdentity(enteredName, enteredPhone, "stub-ci:" + hasher.hash("stub:" + enteredPhone),
				"stub-di:" + hasher.hash("stub-di:" + enteredPhone), VerificationProvider.STUB));
	}

}
