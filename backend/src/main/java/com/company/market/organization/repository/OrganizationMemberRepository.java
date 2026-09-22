package com.company.market.organization.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.organization.domain.MemberRole;
import com.company.market.organization.domain.OrganizationMember;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, UUID> {

	Optional<OrganizationMember> findByOrganizationIdAndRole(UUID organizationId, MemberRole role);

}
