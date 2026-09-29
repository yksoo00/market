package com.company.market.user.service;

import com.company.market.common.config.AppProperties;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.domain.UserRole;
import com.company.market.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 첫 관리자. 화면에서 가입 불가하므로 admin 이 한 명도 없을 때 환경변수로 1명 만든다 (data-model.md 결정 1).
 * 마이그레이션에 해시를 넣지 않는 이유: 해시가 저장소에 남으면 비밀번호를 바꿔도 이력에 남기 때문.
 * must_change_password=true 로 첫 로그인 직후 변경을 강제한다.
 */
@Component
@RequiredArgsConstructor
public class AdminSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(AdminSeeder.class);

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final AppProperties props;

	@Override
	public void run(ApplicationArguments args) {
		if (users.existsByRoleAndDeletedAtIsNull(UserRole.ADMIN)) {
			return;
		}
		AppProperties.Admin admin = props.admin();
		if (admin == null || isBlank(admin.loginId()) || isBlank(admin.password())) {
			log.warn("관리자 계정이 없고 ADMIN_LOGIN_ID/ADMIN_PASSWORD 도 비어 있어 시드하지 않음");
			return;
		}
		try {
			users.save(User.builder()
				.kind(UserKind.PERSONAL)
				.role(UserRole.ADMIN)
				.loginId(admin.loginId())
				.passwordHash(passwordEncoder.encode(admin.password()))
				.name(admin.loginId())
				.nickname(admin.loginId())
				.nicknameUsage("Y")
				.mustChangePassword(true)
				.build());
			log.info("관리자 계정 시드 완료");
		}
		catch (DataIntegrityViolationException e) {
			// api-1/api-2 가 동시에 뜨면 한쪽이 유일 제약에 걸린다. 다른 인스턴스가 만든 것이니 정상
			log.info("관리자 계정은 다른 인스턴스가 먼저 시드함");
		}
	}

	private static boolean isBlank(String s) {
		return s == null || s.isBlank();
	}

}
