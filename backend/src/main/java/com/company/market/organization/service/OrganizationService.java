package com.company.market.organization.service;

import java.util.Optional;
import java.util.UUID;

import com.company.market.organization.domain.MemberRole;
import com.company.market.organization.repository.OrganizationMemberRepository;
import com.company.market.organization.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrganizationService {

	private final OrganizationRepository organizations;

	private final OrganizationMemberRepository members;

	/** 기업 로그인: 사업자번호 → owner 담당자의 user id. 다른 도메인(user)은 이 메서드로만 조직을 본다 */
	public Optional<UUID> findOwnerUserId(String bizNo) {
		return organizations.findByBizNoAndDeletedAtIsNull(bizNo)
			.flatMap(org -> members.findByOrganizationIdAndRole(org.getId(), MemberRole.OWNER))
			.map(m -> m.getUser().getId());
	}

}
