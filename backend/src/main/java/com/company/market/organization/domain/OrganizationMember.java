package com.company.market.organization.domain;

import com.company.market.common.domain.BaseEntity;
import com.company.market.user.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/** 사업자 ↔ 담당자(kind=business 사용자). OWNER 는 조직당 하나, 한 사람은 한 조직만 (유니크 인덱스) */
@Entity
@Table(name = "organization_members")
@Getter
public class OrganizationMember extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "organization_id")
	private Organization organization;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id")
	private User user;

	@Column(nullable = false)
	private MemberRole role;

	protected OrganizationMember() {
	}

	@Builder
	private OrganizationMember(Organization organization, User user, MemberRole role) {
		this.organization = organization;
		this.user = user;
		this.role = role == null ? MemberRole.OWNER : role;
	}

}
