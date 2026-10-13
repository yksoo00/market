package com.company.market.user.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByLoginId(String loginId);

	boolean existsByLoginId(String loginId);

	/** 별칭 사용이 켜진 개인 계정에서 별칭 중복을 검사한다. */
	@Query("select count(u) > 0 from User u where u.userNickname = :nickname and u.kind = :kind")
	boolean existsByNicknameAndKind(@Param("nickname") String nickname, @Param("kind") UserKind kind);

	/** 이메일 중복 확인. 개인정보 암호화 컬럼이 아니라 단일 users 표의 값을 직접 조회한다. */
	@Query("select count(u) > 0 from User u where lower(u.email) = lower(:email)")
	boolean existsByEmailIgnoreCaseActive(@Param("email") String email);

	@Query("select u from User u where lower(u.email) = lower(:email)")
	Optional<User> findByEmailIgnoreCaseActive(@Param("email") String email);

	boolean existsByPhone(String phone);

	Optional<User> findByBusRegId(String busRegId);

	boolean existsByBusRegId(String busRegId);

}
