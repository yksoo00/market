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

/** 소셜 로그인 연결. 계정당 하나 — 카카오로 가입했으면 네이버 추가 연결 불가 (decisions.md 2026-09-22) */
@Entity
@Table(name = "social_accounts")
@Getter
public class SocialAccount extends BaseEntity {

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id")
	private User user;

	@Column(nullable = false)
	private SocialProvider provider;

	/** 제공자의 회원 고유번호 */
	@Column(nullable = false)
	private String providerUserId;

	/** 제공자가 준 이메일. users.email 과 별도 보관 (사용자가 바꿔도 대조용) */
	@Convert(converter = PiiConverter.class)
	private String providerEmail;

	@Column(nullable = false)
	private Instant connectedAt;

	protected SocialAccount() {
	}

	@Builder
	private SocialAccount(User user, SocialProvider provider, String providerUserId, String providerEmail) {
		this.user = user;
		this.provider = provider;
		this.providerUserId = providerUserId;
		this.providerEmail = providerEmail;
		this.connectedAt = Instant.now();
	}

}
