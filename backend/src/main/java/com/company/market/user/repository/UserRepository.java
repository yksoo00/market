package com.company.market.user.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByLoginIdAndDeletedAtIsNull(String loginId);

	boolean existsByRoleAndDeletedAtIsNull(UserRole role);

	boolean existsByLoginIdAndDeletedAtIsNull(String loginId);

	/** 닉네임 유일은 personal 만 (business 는 기업명이라 중복 허용) */
	boolean existsByNicknameAndKindAndDeletedAtIsNull(String nickname, UserKind kind);

	/** 유일 인덱스가 lower(email) 이라 같은 식으로 비교해야 인덱스를 탄다 */
	@Query("select count(u) > 0 from User u where lower(u.email) = lower(:email) and u.deletedAt is null")
	boolean existsByEmailIgnoreCaseActive(@Param("email") String email);

	boolean existsByPhoneHashAndDeletedAtIsNull(String phoneHash);

	@Query("select u from User u where lower(u.email) = lower(:email) and u.deletedAt is null")
	Optional<User> findByEmailIgnoreCaseActive(@Param("email") String email);

}
