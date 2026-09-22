package com.company.market.user.domain;

import java.net.InetAddress;
import java.time.Instant;

import com.company.market.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/** 약관 동의 기록. 수정하지 않고 철회는 새 행. 탈퇴해도 유지 (증빙 5년) */
@Entity
@Table(name = "terms_agreements")
@Getter
public class TermsAgreement extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id")
	private User user;

	@Column(nullable = false)
	private TermsId termsId;

	/** 약관 시행일 YYYY-MM-DD. 문안이 바뀌면 새 버전으로 재동의 */
	@Column(nullable = false)
	private String version;

	/** 선택 항목 미동의도 기록 (거부 사실 증빙) */
	@Column(nullable = false)
	private boolean agreed;

	@Column(nullable = false)
	private Instant agreedAt;

	/** 동의 증빙용. 90일 후 null 처리 */
	private InetAddress ip;

	protected TermsAgreement() {
	}

	@Builder
	private TermsAgreement(User user, TermsId termsId, String version, boolean agreed, InetAddress ip) {
		this.user = user;
		this.termsId = termsId;
		this.version = version;
		this.agreed = agreed;
		this.agreedAt = Instant.now();
		this.ip = ip;
	}

}
