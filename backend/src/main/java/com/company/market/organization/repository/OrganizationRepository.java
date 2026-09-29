package com.company.market.organization.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.organization.domain.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean // 사업자 정보를 users 행으로 통합함
public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

	Optional<Organization> findByBizNoAndDeletedAtIsNull(String bizNo);

}
