package com.company.market.user.repository;

import java.util.UUID;

import com.company.market.user.domain.IdentityVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean // 인증 결과 테이블을 사용하지 않음
public interface IdentityVerificationRepository extends JpaRepository<IdentityVerification, UUID> {

	boolean existsByCiHash(String ciHash);

}
