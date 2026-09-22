package com.company.market.user.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.user.domain.User;
import com.company.market.user.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByLoginIdAndDeletedAtIsNull(String loginId);

	boolean existsByRoleAndDeletedAtIsNull(UserRole role);

}
