package com.company.market.user.domain;

import java.time.Instant;

import com.company.market.common.crypto.PiiConverter;
import com.company.market.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/**
 * 로그인 주체 하나 = 한 행. 일반(아이디·소셜)과 기업 담당자가 같은 테이블, kind 로 구분 (data-model.md 1절).
 * 이름·휴대폰·이메일은 PII — API 응답·로그에 내보내지 않는다.
 */
@Entity
@Table(name = "users")
@Getter
public class User extends BaseEntity {

	@Column(nullable = false)
	private UserKind kind;

	@Column(nullable = false)
	private UserRole role;

	@Column(nullable = false)
	private UserStatus status;

	/** personal 아이디 로그인만. 소셜·기업은 null. 변경 불가(서비스에서 보장). 탈퇴 시 null 로 지우므로 updatable=false 는 안 됨 */
	private String loginId;

	/** bcrypt. 소셜만 null — DB 가 아니라 앱에서 검사 */
	private String passwordHash;

	/** personal 표시명(유일) / business 는 기업명(중복 허용) */
	@Column(nullable = false)
	private String nickname;

	private String email;

	private Instant emailVerifiedAt;

	@Convert(converter = PiiConverter.class)
	private String name;

	/** 숫자만 저장 */
	@Convert(converter = PiiConverter.class)
	private String phone;

	/** PiiHasher.hash(phone). 암호화 컬럼은 검색이 안 되므로 중복 가입 검사는 이 컬럼으로. phone 과 같이 넣는다 */
	private String phoneHash;

	private Instant marketingOptInAt;

	private Instant lastLoginAt;

	/** 시드 관리자·관리자가 초기화한 비밀번호. true 면 로그인 직후 변경 화면으로 */
	@Column(nullable = false)
	private boolean mustChangePassword;

	private Instant deletedAt;

	protected User() {
	}

	@Builder
	private User(UserKind kind, UserRole role, String loginId, String passwordHash, String nickname, String email,
			Instant emailVerifiedAt, String name, String phone, String phoneHash, Instant marketingOptInAt,
			boolean mustChangePassword) {
		if ((phone == null) != (phoneHash == null)) {
			throw new IllegalArgumentException("phone 과 phoneHash 는 같이 있거나 같이 없어야 함");
		}
		this.kind = kind;
		this.role = role == null ? UserRole.USER : role;
		this.status = UserStatus.ACTIVE;
		this.loginId = loginId;
		this.passwordHash = passwordHash;
		this.nickname = nickname;
		this.email = email;
		this.emailVerifiedAt = emailVerifiedAt;
		this.name = name;
		this.phone = phone;
		this.phoneHash = phoneHash;
		this.marketingOptInAt = marketingOptInAt;
		this.mustChangePassword = mustChangePassword;
	}

	/** 로그인 가능한 상태인가. 정지·탈퇴는 불가 */
	public boolean isActive() {
		return status == UserStatus.ACTIVE && deletedAt == null;
	}

	public void recordLogin() {
		this.lastLoginAt = Instant.now();
	}

}
