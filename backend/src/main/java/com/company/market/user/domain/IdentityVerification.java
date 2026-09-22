package com.company.market.user.domain;

import java.time.Instant;

import com.company.market.common.crypto.PiiConverter;
import com.company.market.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/**
 * 휴대폰 본인인증 결과 (일반 회원 1:1). ci_hash 유일 제약이 "한 사람 = 계정 하나"를 보장.
 * 탈퇴 시 하드 삭제 (개인정보 즉시 파기 — soft delete 규칙의 예외).
 */
@Entity
@Table(name = "identity_verifications")
@Getter
public class IdentityVerification extends BaseEntity {

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id")
	private User user;

	@Column(nullable = false)
	private VerificationProvider provider;

	/** 연계정보 88자 */
	@Convert(converter = PiiConverter.class)
	@Column(nullable = false)
	private String ci;

	/** PiiHasher.hash(ci). 아이디·비밀번호 찾기 조회도 이 컬럼 */
	@Column(nullable = false)
	private String ciHash;

	/** 중복가입확인정보 */
	@Convert(converter = PiiConverter.class)
	@Column(nullable = false)
	private String di;

	/** 마지막 인증 시각. 재인증 시 갱신 */
	@Column(nullable = false)
	private Instant verifiedAt;

	protected IdentityVerification() {
	}

	@Builder
	private IdentityVerification(User user, VerificationProvider provider, String ci, String ciHash, String di,
			Instant verifiedAt) {
		this.user = user;
		this.provider = provider;
		this.ci = ci;
		this.ciHash = ciHash;
		this.di = di;
		this.verifiedAt = verifiedAt;
	}

}
