package com.company.market.user.service;

import java.util.Optional;
import java.util.UUID;

import com.company.market.common.auth.JwtProvider;
import com.company.market.common.auth.LoginAttemptGuard;
import com.company.market.common.auth.RefreshSessionStore;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.dto.LoginResult;
import com.company.market.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 로그인 메서드에 @Transactional 을 걸지 않는 이유: bcrypt(cost 12, ~250ms)와 Redis 호출 동안 DB 커넥션을 붙잡고 있으면
 * 로그인이 몰릴 때 풀이 말라 다른 API 까지 멈춘다. 조회는 리포지토리 호출 하나, 갱신은 save 하나로 각자 짧게 끝낸다.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

	/** 보안 이벤트. userId·IP 만 — 아이디·이메일은 로그 금지 (security.md "로그·감사") */
	private static final Logger log = LoggerFactory.getLogger(AuthService.class);

	/**
	 * 없는 아이디도 bcrypt 를 한 번 돌려 응답 시간을 맞춘다. 안 그러면 "아이디 있음/없음"이 시간으로 구분됨.
	 * 아무 비밀번호와도 일치하지 않는 임의의 해시.
	 */
	private static final String DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5nMv2Fh3zM8ZzAKzYQzd0xh3G2j1Gce";

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final JwtProvider jwt;

	private final RefreshSessionStore sessions;

	private final LoginAttemptGuard attempts;

	public LoginResult login(String loginId, String password, boolean remember, String ip) {
		attempts.check(loginId, ip);
		Optional<User> user = users.findByLoginIdAndDeletedAtIsNull(loginId).filter(u -> u.getKind() == UserKind.PERSONAL);
		return authenticate(loginId, user, password, remember, ip);
	}

	/** 기업: 사업자번호 → owner 담당자. 담당자 계정의 비밀번호로 확인 */
	public LoginResult loginBusiness(String bizNo, String password, boolean remember, String ip) {
		attempts.check(bizNo, ip);
		Optional<User> user = users.findByBusRegIdAndDeletedAtIsNull(bizNo).filter(u -> u.getKind() == UserKind.BUSINESS);
		return authenticate(bizNo, user, password, remember, ip);
	}

	private LoginResult authenticate(String account, Optional<User> found, String password, boolean remember, String ip) {
		String hash = found.map(User::getPasswordHash).orElse(DUMMY_HASH);
		// 소셜 전용 계정은 password_hash 가 null → 아이디/비번 로그인 불가
		boolean matches = hash != null && passwordEncoder.matches(password, hash);
		if (found.isEmpty() || !matches || found.get().getDeletedAt() != null) {
			attempts.recordFailure(account, ip);
			log.info("로그인 실패 userId={} ip={}", found.map(u -> u.getId().toString()).orElse("-"), ip);
			throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
		}
		User user = found.get();
		if (!user.isActive()) {
			// 비밀번호까지 맞은 뒤에만 알려준다 — 정지 여부도 계정 정보라서
			log.warn("정지 계정 로그인 시도 userId={} ip={}", user.getId(), ip);
			throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED);
		}
		attempts.recordSuccess(account);
		user.recordLogin();
		users.save(user);
		log.info("로그인 userId={} ip={}", user.getId(), ip);
		return new LoginResult(user.getId(), jwt.createAccessToken(user.getId(), user.getRole()), sessions.issue(user.getId(), remember), remember);
	}

	/** refresh 회전. 실패 이유(만료·로그아웃·재사용 감지)는 구분해서 알려주지 않는다 */
	public LoginResult refresh(String refreshToken) {
		RefreshSessionStore.Rotated rotated = sessions.rotate(refreshToken)
			.orElseThrow(() -> new ApiException(ErrorCode.SESSION_EXPIRED));
		User user = users.findById(rotated.userId()).filter(User::isActive).orElseThrow(() -> {
			sessions.revokeAll(rotated.userId());
			return new ApiException(ErrorCode.SESSION_EXPIRED);
		});
		return new LoginResult(user.getId(), jwt.createAccessToken(user.getId(), user.getRole()), rotated.token(), rotated.remember());
	}

	public void logout(String refreshToken) {
		sessions.revoke(refreshToken);
	}

	public void logoutAll(UUID userId) {
		sessions.revokeAll(userId);
	}

}
