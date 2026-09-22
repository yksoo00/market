package com.company.market.user.service;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.company.market.common.config.AppProperties;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.user.domain.IdentityVerification;
import com.company.market.user.domain.TermsAgreement;
import com.company.market.user.domain.TermsId;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.dto.SignupPersonalRequest;
import com.company.market.user.repository.IdentityVerificationRepository;
import com.company.market.user.repository.TermsAgreementRepository;
import com.company.market.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class SignupService {

	private static final Logger log = LoggerFactory.getLogger(SignupService.class);

	/** 가입 IP 5회/시간 (security.md "Rate limit") */
	private static final int SIGNUP_PER_IP = 5;

	private static final Duration SIGNUP_WINDOW = Duration.ofHours(1);

	/** 중복확인 IP 분당 30회 — 무제한이면 "어떤 아이디가 존재하나"를 사전으로 훑을 수 있다 */
	private static final int CHECK_PER_IP = 30;

	private static final Duration CHECK_WINDOW = Duration.ofMinutes(1);

	/** 일반 가입 약관 4개. 필수 3개는 프론트가 동의 없이 제출하지 못하므로 true, 마케팅만 선택값 */
	private static final List<TermsId> REQUIRED_TERMS = List.of(TermsId.SERVICE, TermsId.PRIVACY, TermsId.AGE);

	/** 유일 제약 이름 → 오류 코드. 미리 확인해도 동시 가입 경쟁은 DB 만 잡을 수 있어서 */
	private static final Map<String, ErrorCode> CONSTRAINT_CODES = Map.of(
			"ux_users_login_id", ErrorCode.DUPLICATE_LOGIN_ID,
			"ux_users_nickname_personal", ErrorCode.DUPLICATE_NICKNAME,
			"ux_users_email", ErrorCode.DUPLICATE_EMAIL,
			"ux_users_phone_hash", ErrorCode.DUPLICATE_PHONE,
			"ux_identity_verifications_ci_hash", ErrorCode.ALREADY_REGISTERED);

	private final UserRepository users;

	private final IdentityVerificationRepository verifications;

	private final TermsAgreementRepository terms;

	private final IdentityVerifier verifier;

	private final PasswordEncoder passwordEncoder;

	private final PiiHasher hasher;

	private final RateLimiter limiter;

	private final AppProperties props;

	/** 같은 클래스의 @Transactional 메서드는 프록시를 안 거쳐 트랜잭션이 안 걸리므로 템플릿으로 감싼다 */
	private final TransactionTemplate tx;

	public boolean isLoginIdAvailable(String loginId, String ip) {
		limiter.hit("signup:check:ip:" + ip, CHECK_PER_IP, CHECK_WINDOW);
		return !users.existsByLoginIdAndDeletedAtIsNull(loginId);
	}

	public boolean isNicknameAvailable(String nickname, String ip) {
		limiter.hit("signup:check:ip:" + ip, CHECK_PER_IP, CHECK_WINDOW);
		return !users.existsByNicknameAndKindAndDeletedAtIsNull(nickname, UserKind.PERSONAL);
	}

	/**
	 * 일반 가입. users + identity_verifications + terms_agreements ×4 를 한 트랜잭션에 (data-model.md "흐름별 쓰기").
	 * 비밀번호 해시(bcrypt ~250ms)는 트랜잭션 밖에서 먼저 계산해 DB 커넥션을 오래 잡지 않는다.
	 */
	public UUID signupPersonal(SignupPersonalRequest req, String ip) {
		limiter.hit("signup:ip:" + ip, SIGNUP_PER_IP, SIGNUP_WINDOW);

		// 아이디 포함 금지는 두 필드가 필요해 Bean Validation 이 아니라 여기서. 응답은 같은 VALIDATION 형식
		if (req.password().toLowerCase(Locale.ROOT).contains(req.loginId().toLowerCase(Locale.ROOT))) {
			throw new ValidationException(Map.of("password", "비밀번호에 아이디를 포함할 수 없습니다."));
		}

		IdentityVerifier.VerifiedIdentity identity = verifier.resolve(req.verificationToken(), req.name(), req.phone())
			.orElseThrow(() -> new ApiException(ErrorCode.VERIFICATION_EXPIRED));

		String email = req.email().trim().toLowerCase(Locale.ROOT);
		String phoneHash = hasher.hash(identity.phone());
		String ciHash = hasher.hash(identity.ci());
		checkDuplicates(req.loginId(), req.nickname(), email, phoneHash, ciHash);

		String passwordHash = passwordEncoder.encode(req.password());
		try {
			UUID userId = tx.execute(status -> persist(req, identity, email, phoneHash, ciHash, passwordHash, ip));
			log.info("일반 가입 userId={} ip={}", userId, ip);
			return userId;
		}
		catch (DataIntegrityViolationException e) {
			throw duplicateFrom(e);
		}
	}

	private void checkDuplicates(String loginId, String nickname, String email, String phoneHash, String ciHash) {
		if (users.existsByLoginIdAndDeletedAtIsNull(loginId)) {
			throw new ApiException(ErrorCode.DUPLICATE_LOGIN_ID);
		}
		if (users.existsByNicknameAndKindAndDeletedAtIsNull(nickname, UserKind.PERSONAL)) {
			throw new ApiException(ErrorCode.DUPLICATE_NICKNAME);
		}
		// 같은 사람(CI)이 이미 있으면 이메일·휴대폰보다 먼저 알려준다 — "아이디 찾기" 안내가 맞는 상황이고,
		// 기존 회원이 다른 이메일의 가입 여부를 확인하는 데 이 응답을 쓰지 못하게
		if (verifications.existsByCiHash(ciHash)) {
			throw new ApiException(ErrorCode.ALREADY_REGISTERED);
		}
		if (users.existsByEmailIgnoreCaseActive(email)) {
			throw new ApiException(ErrorCode.DUPLICATE_EMAIL);
		}
		if (users.existsByPhoneHashAndDeletedAtIsNull(phoneHash)) {
			throw new ApiException(ErrorCode.DUPLICATE_PHONE);
		}
	}

	private UUID persist(SignupPersonalRequest req, IdentityVerifier.VerifiedIdentity identity, String email, String phoneHash,
			String ciHash, String passwordHash, String ip) {
		User user = users.save(User.builder()
			.kind(UserKind.PERSONAL)
			.loginId(req.loginId())
			.passwordHash(passwordHash)
			.nickname(req.nickname())
			.email(email)
			.name(identity.name())
			.phone(identity.phone())
			.phoneHash(phoneHash)
			.marketingOptInAt(req.marketingOptIn() ? Instant.now() : null)
			.build());
		verifications.save(IdentityVerification.builder()
			.user(user)
			.provider(identity.provider())
			.ci(identity.ci())
			.ciHash(ciHash)
			.di(identity.di())
			.verifiedAt(Instant.now())
			.build());
		InetAddress address = parseIp(ip);
		String version = props.terms().version();
		for (TermsId id : REQUIRED_TERMS) {
			terms.save(TermsAgreement.builder().user(user).termsId(id).version(version).agreed(true).ip(address).build());
		}
		terms.save(TermsAgreement.builder().user(user).termsId(TermsId.MARKETING).version(version).agreed(req.marketingOptIn()).ip(address).build());
		return user.getId();
	}

	private static InetAddress parseIp(String ip) {
		try {
			// 리터럴 IP 만 온다. 이상한 값이면 증빙 IP 는 비워두고 가입은 진행
			return ip == null || ip.isBlank() ? null : InetAddress.getByName(ip);
		}
		catch (UnknownHostException e) {
			return null;
		}
	}

	private static ApiException duplicateFrom(DataIntegrityViolationException e) {
		String message = String.valueOf(e.getMostSpecificCause().getMessage());
		return CONSTRAINT_CODES.entrySet().stream()
			.filter(entry -> message.contains(entry.getKey()))
			.map(entry -> new ApiException(entry.getValue()))
			.findFirst()
			.orElseThrow(() -> e);
	}

}
