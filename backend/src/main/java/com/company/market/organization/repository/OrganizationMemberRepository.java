package com.company.market.organization.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.organization.domain.MemberRole;
import com.company.market.organization.domain.OrganizationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean // 조직 멤버 테이블을 사용하지 않음
public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, UUID> {

	Optional<OrganizationMember> findByOrganizationIdAndRole(UUID organizationId, MemberRole role);

}
