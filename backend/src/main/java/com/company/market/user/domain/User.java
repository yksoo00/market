package com.company.market.user.domain;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/**
 * 개인·기업 사용자 정보는 한 행에 저장한다. 세부 컬럼 정의는 docs/data-model.md를 따른다.
 */
@Entity
@Table(name = "users")
@Getter
public class User {

	private static final DateTimeFormatter DATABASE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "user_class", nullable = false, length = 10)
	private UserKind kind;

	@Column(name = "role", nullable = false, length = 10)
	private UserRole role;

	@Column(name = "status", nullable = false, length = 10)
	private UserStatus status;

	/** 로그인 ID. */
	@Column(name = "user_id", nullable = false, length = 20)
	private String loginId;

	/** bcrypt 해시. 원문 비밀번호를 저장하지 않는다. */
	@Column(name = "password", nullable = false, length = 200)
	private String passwordHash;

	@Column(name = "user_name", nullable = false, length = 50)
	private String name;

	@Column(name = "user_phone", length = 20)
	private String phone;

	@Column(name = "user_tel", length = 20)
	private String userTel;

	@Column(name = "user_email", length = 100)
	private String email;

	@Column(name = "user_address", length = 200)
	private String userAddress;

	@Column(name = "bus_reg_id", length = 20)
	private String busRegId;

	@Column(name = "company_type", length = 10)
	private String companyType;

	@Column(name = "company_name", length = 50)
	private String companyName;

	@Column(name = "company_open_date", length = 10)
	private String companyOpenDate;

	@Column(name = "company_tel", length = 20)
	private String companyTel;

	@Column(name = "company_address", length = 200)
	private String companyAddress;

	@Column(name = "dt_reg", nullable = false, length = 14, updatable = false)
	private String dtReg;

	@Column(name = "dt_update", nullable = false, length = 14)
	private String dtUpdate;

	@Column(name = "dt_expire", length = 14)
	private String dtExpire;

	@Column(name = "user_nickname", length = 100)
	private String userNickname;

	@Column(name = "nickname_usage", nullable = false, length = 1)
	private String nicknameUsage;

	@Column(name = "contact_method", nullable = false, length = 1)
	private String contactMethod;

	@Column(name = "spare_col", length = 40)
	private String spareCol;

	/** 시드 관리자·관리자가 초기화한 비밀번호. true 면 로그인 직후 변경 화면으로 */
	@Column(nullable = false)
	private boolean mustChangePassword;

	@Column(name = "deleted_at")
	private Instant deletedAt;

	protected User() {
	}

	@Builder
	private User(UserKind kind, UserRole role, String loginId, String passwordHash, String nickname,
			Instant emailVerifiedAt, String phoneHash, Instant marketingOptInAt, String name, String phone,
			String userTel, String email, String userAddress, String busRegId, String companyType, String companyName,
			String companyOpenDate, String companyTel, String companyAddress, String dtExpire, String userNickname,
			String nicknameUsage, String contactMethod, String spareCol, boolean mustChangePassword) {
		this.kind = kind;
		this.role = role == null ? UserRole.USER : role;
		this.status = UserStatus.ACTIVE;
		this.loginId = loginId;
		this.passwordHash = passwordHash;
		this.name = name;
		this.phone = phone;
		this.userTel = userTel;
		this.email = email;
		this.userAddress = userAddress;
		this.busRegId = busRegId;
		this.companyType = companyType;
		this.companyName = companyName;
		this.companyOpenDate = companyOpenDate;
		this.companyTel = companyTel;
		this.companyAddress = companyAddress;
		this.dtExpire = dtExpire;
		this.userNickname = userNickname == null ? nickname : userNickname;
		this.nicknameUsage = nicknameUsage == null ? "N" : nicknameUsage;
		this.contactMethod = contactMethod == null ? "1" : contactMethod;
		this.spareCol = spareCol;
		this.mustChangePassword = mustChangePassword;
		// 예전 소셜·해시 필드는 builder 호출부의 이행 중 컴파일 호환용이며 단일 users 표에 저장하지 않는다.
	}

	@PrePersist
	void onCreate() {
		String now = LocalDateTime.now(ZoneOffset.UTC).format(DATABASE_TIMESTAMP);
		if (dtReg == null) {
			dtReg = now;
		}
		dtUpdate = now;
	}

	@PreUpdate
	void onUpdate() {
		dtUpdate = LocalDateTime.now(ZoneOffset.UTC).format(DATABASE_TIMESTAMP);
	}

	/** 로그인 가능한 상태인가. 정지·탈퇴는 불가 */
	public boolean isActive() {
		String now = LocalDateTime.now(ZoneOffset.UTC).format(DATABASE_TIMESTAMP);
		return status == UserStatus.ACTIVE && deletedAt == null && (dtExpire == null || dtExpire.isBlank() || dtExpire.compareTo(now) > 0);
	}

	public String getNickname() {
		if (kind == UserKind.BUSINESS) {
			return companyName != null && !companyName.isBlank() ? companyName : loginId;
		}
		if ("Y".equals(nicknameUsage) && userNickname != null) {
			return userNickname;
		}
		return loginId;
	}

	public void recordLogin() {
		dtUpdate = LocalDateTime.now(ZoneOffset.UTC).format(DATABASE_TIMESTAMP);
	}

}
