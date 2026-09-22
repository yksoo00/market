package com.company.market.user.repository;

import java.util.UUID;

import com.company.market.user.domain.IdentityVerification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdentityVerificationRepository extends JpaRepository<IdentityVerification, UUID> {

	boolean existsByCiHash(String ciHash);

}
