package com.company.market.user.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.user.domain.SocialAccount;
import com.company.market.user.domain.SocialProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, UUID> {

	/** user 를 같이 가져온다 — 콜백 처리는 트랜잭션 밖이라 LAZY 프록시를 나중에 열 수 없다 */
	@Query("select s from SocialAccount s join fetch s.user where s.provider = :provider and s.providerUserId = :providerUserId")
	Optional<SocialAccount> findByProviderAndProviderUserId(@Param("provider") SocialProvider provider, @Param("providerUserId") String providerUserId);

	Optional<SocialAccount> findByUserId(UUID userId);

}
