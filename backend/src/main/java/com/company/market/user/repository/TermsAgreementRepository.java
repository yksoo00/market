package com.company.market.user.repository;

import java.util.UUID;

import com.company.market.user.domain.TermsAgreement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean // 약관 테이블을 사용하지 않음
public interface TermsAgreementRepository extends JpaRepository<TermsAgreement, UUID> {

}
