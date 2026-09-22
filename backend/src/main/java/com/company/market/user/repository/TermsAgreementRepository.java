package com.company.market.user.repository;

import java.util.UUID;

import com.company.market.user.domain.TermsAgreement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TermsAgreementRepository extends JpaRepository<TermsAgreement, UUID> {

}
