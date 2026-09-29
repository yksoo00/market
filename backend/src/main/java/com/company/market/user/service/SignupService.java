package com.company.market.user.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.company.market.common.config.AppProperties;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.dto.SignupPersonalRequest;
import com.company.market.user.dto.BusinessVerifyRequest;
import com.company.market.user.dto.SignupBusinessRequest;
import com.company.market.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
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

	private static final String BUSINESS_VERIFY_PREFIX = "signup:biz:";

	private static final Duration BUSINESS_VERIFY_TTL = Duration.ofMinutes(30);

	/** 유일 제약 이름 → 오류 코드. 미리 확인해도 동시 가입 경쟁은 DB 만 잡을 수 있어서 */
	private static final Map<String, ErrorCode> CONSTRAINT_CODES = Map.of(
			"ux_users_user_id", ErrorCode.DUPLICATE_LOGIN_ID,
			"ux_users_nickname", ErrorCode.DUPLICATE_NICKNAME,
			"ux_users_email", ErrorCode.DUPLICATE_EMAIL,
			"ux_users_phone", ErrorCode.DUPLICATE_PHONE,
			"ux_users_bus_reg_id", ErrorCode.DUPLICATE_BIZ_NO);

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final RateLimiter limiter;

	private final AppProperties props;

	/** 같은 클래스의 @Transactional 메서드는 프록시를 안 거쳐 트랜잭션이 안 걸리므로 템플릿으로 감싼다 */
	private final TransactionTemplate tx;

	private final StringRedisTemplate redis;

	public boolean isLoginIdAvailable(String loginId, String ip) {
		limiter.hit("signup:check:ip:" + ip, CHECK_PER_IP, CHECK_WINDOW);
		return !users.existsByLoginIdAndDeletedAtIsNull(loginId);
	}

	public boolean isNicknameAvailable(String nickname, String ip) {
		limiter.hit("signup:check:ip:" + ip, CHECK_PER_IP, CHECK_WINDOW);
		return !users.existsByNicknameAndKindAndDeletedAtIsNull(nickname, UserKind.PERSONAL);
	}

	/**
	 * 일반 가입. 단일 users 행으로 저장한다.
	 * 비밀번호 해시(bcrypt ~250ms)는 트랜잭션 밖에서 먼저 계산해 DB 커넥션을 오래 잡지 않는다.
	 */
	public UUID signupPersonal(SignupPersonalRequest req, String ip) {
		limiter.hit("signup:ip:" + ip, SIGNUP_PER_IP, SIGNUP_WINDOW);

		// 아이디 포함 금지는 두 필드가 필요해 Bean Validation 이 아니라 여기서. 응답은 같은 VALIDATION 형식
		if (req.password().toLowerCase(Locale.ROOT).contains(req.loginId().toLowerCase(Locale.ROOT))) {
			throw new ValidationException(Map.of("password", "비밀번호에 아이디를 포함할 수 없습니다."));
		}

		String email = req.email().trim().toLowerCase(Locale.ROOT);
		if ("Y".equals(req.nicknameUsage()) && (req.nickname() == null || req.nickname().isBlank())) {
			throw new ValidationException(Map.of("nickname", "별명을 입력하세요."));
		}
		checkDuplicates(req.loginId(), req.nickname(), email, req.phone(), "Y".equals(req.nicknameUsage()));

		String passwordHash = passwordEncoder.encode(req.password());
		try {
			UUID userId = tx.execute(status -> persist(req, email, passwordHash));
			log.info("일반 가입 userId={} ip={}", userId, ip);
			return userId;
		}
		catch (DataIntegrityViolationException e) {
			throw duplicateFrom(e);
		}
	}

	/** 실제 국세청 연동 전까지 로컬 개발에서만 사업자 인증 토큰을 발급한다. */
	public String verifyBusiness(BusinessVerifyRequest req, String ip) {
		limiter.hit("signup:biz-verify:ip:" + ip, SIGNUP_PER_IP, SIGNUP_WINDOW);
		if (!props.isLocal()) {
			throw new ApiException(ErrorCode.BUSINESS_VERIFICATION_UNAVAILABLE);
		}
		try {
			LocalDate startDate = LocalDate.parse(req.startDate(), java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
			if (!startDate.isBefore(LocalDate.now())) {
				throw new ValidationException(Map.of("startDate", "개업년월일은 오늘 이전 날짜여야 합니다."));
			}
		}
		catch (DateTimeParseException e) {
			throw new ValidationException(Map.of("startDate", "개업년월일이 올바른 날짜가 아닙니다."));
		}
		if (users.findByBusRegIdAndDeletedAtIsNull(req.bizNo()).isPresent()) {
			throw new ApiException(ErrorCode.DUPLICATE_BIZ_NO);
		}
		String token = UUID.randomUUID().toString();
		String value = String.join("|", req.bizNo(), req.startDate(), req.ownerName());
		redis.opsForValue().set(BUSINESS_VERIFY_PREFIX + token, value, BUSINESS_VERIFY_TTL);
		return token;
	}

	/** 사업자 기본 정보는 검증 토큰에서 가져오고, 계정·회사 정보는 users 한 행에 저장한다. */
	public UUID signupBusiness(SignupBusinessRequest req, String ip) {
		limiter.hit("signup:ip:" + ip, SIGNUP_PER_IP, SIGNUP_WINDOW);
		String verified = redis.opsForValue().getAndDelete(BUSINESS_VERIFY_PREFIX + req.verificationToken());
		if (verified == null) {
			throw new ApiException(ErrorCode.VERIFICATION_EXPIRED);
		}
		String[] details = verified.split("\\|", 3);
		String bizNo = details[0];
		String startDate = details[1];
		if (req.password().toLowerCase(Locale.ROOT).contains(bizNo)) {
			throw new ValidationException(Map.of("password", "비밀번호에 사업자등록번호를 포함할 수 없습니다."));
		}
		String email = req.contactEmail().trim().toLowerCase(Locale.ROOT);
		if (users.existsByBusRegIdAndDeletedAtIsNull(bizNo) || users.existsByLoginIdAndDeletedAtIsNull(bizNo)) {
			throw new ApiException(ErrorCode.DUPLICATE_BIZ_NO);
		}
		if (users.existsByEmailIgnoreCaseActive(email)) {
			throw new ApiException(ErrorCode.DUPLICATE_EMAIL);
		}
		if (users.existsByPhoneAndDeletedAtIsNull(req.contactPhone())) {
			throw new ApiException(ErrorCode.DUPLICATE_PHONE);
		}
		String passwordHash = passwordEncoder.encode(req.password());
		try {
			UUID userId = tx.execute(status -> users.save(User.builder()
				.kind(UserKind.BUSINESS)
				.loginId(bizNo)
				.passwordHash(passwordHash)
				.name(req.contactName())
				.phone(req.contactPhone())
				.userTel(req.contactTel())
				.email(email)
				.userAddress(req.address())
				.busRegId(bizNo)
				.companyType("corporation".equals(req.bizType()) ? "corporate" : req.bizType())
				.companyName(req.companyName())
				.companyOpenDate(startDate)
				.companyTel(req.companyTel())
				.companyAddress(req.address())
				.nicknameUsage("N")
				.build()).getId());
			log.info("기업 가입 userId={} ip={}", userId, ip);
			return userId;
		}
		catch (DataIntegrityViolationException e) {
			throw duplicateFrom(e);
		}
	}

	private void checkDuplicates(String loginId, String nickname, String email, String phone, boolean useNickname) {
		if (users.existsByLoginIdAndDeletedAtIsNull(loginId)) {
			throw new ApiException(ErrorCode.DUPLICATE_LOGIN_ID);
		}
		if (useNickname && users.existsByNicknameAndKindAndDeletedAtIsNull(nickname, UserKind.PERSONAL)) {
			throw new ApiException(ErrorCode.DUPLICATE_NICKNAME);
		}
		if (users.existsByEmailIgnoreCaseActive(email)) {
			throw new ApiException(ErrorCode.DUPLICATE_EMAIL);
		}
		if (users.existsByPhoneAndDeletedAtIsNull(phone)) {
			throw new ApiException(ErrorCode.DUPLICATE_PHONE);
		}
	}

	private UUID persist(SignupPersonalRequest req, String email, String passwordHash) {
		User user = users.save(User.builder()
			.kind(UserKind.PERSONAL)
			.loginId(req.loginId())
			.passwordHash(passwordHash)
			.nickname(req.nickname())
			.nicknameUsage(req.nicknameUsage())
			.email(email)
			.name(req.name())
			.phone(req.phone())
			.userTel(req.tel())
			.userAddress(req.address())
			.contactMethod(req.contactMethod())
			.build());
		return user.getId();
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
