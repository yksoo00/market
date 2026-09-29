package com.company.market.organization.domain;

import java.time.Instant;
import java.time.LocalDate;

import com.company.market.common.domain.BaseEntity;
import com.company.market.user.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/** 사업자. 가입 직후 PENDING, 관리자 심사 후 APPROVED 여야 사업자 배지·사업자 명의 매물 가능 */
// @Entity // 조직 테이블을 제거하고 사업자 정보를 users 행에 통합함
@Table(name = "organizations")
@Getter
public class Organization extends BaseEntity {

	/** 사업자등록번호 숫자 10자리. 사업자번호당 계정 1개 */
	@Column(nullable = false)
	private String bizNo;

	/** 상호 */
	@Column(nullable = false)
	private String name;

	/** 대표자. 국세청 진위확인 입력값 */
	@Column(nullable = false)
	private String ownerName;

	/** 개업년월일 */
	@Column(nullable = false)
	private LocalDate startDate;

	@Column(nullable = false)
	private BizType bizType;

	@Column(nullable = false)
	private String address;

	/** 파일 저장소 키. URL 저장 금지. 저장소 선택 후 사용. 승인 후 90일 뒤 파일 삭제·null */
	private String licenseFileKey;

	/** 국세청 진위확인 통과 시각. stub 인증은 null → 운영에서 가입 거부 */
	private Instant ntsVerifiedAt;

	@Column(nullable = false)
	private ReviewStatus reviewStatus;

	private Instant reviewedAt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "reviewed_by")
	private User reviewedBy;

	private String rejectReason;

	private Instant deletedAt;

	protected Organization() {
	}

	@Builder
	private Organization(String bizNo, String name, String ownerName, LocalDate startDate, BizType bizType,
			String address, String licenseFileKey, Instant ntsVerifiedAt) {
		this.bizNo = bizNo;
		this.name = name;
		this.ownerName = ownerName;
		this.startDate = startDate;
		this.bizType = bizType;
		this.address = address;
		this.licenseFileKey = licenseFileKey;
		this.ntsVerifiedAt = ntsVerifiedAt;
		this.reviewStatus = ReviewStatus.PENDING;
	}

}
