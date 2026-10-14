package com.company.market.user.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
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

	/** 약관 문안의 판. 프론트 messages/terms.ts 의 문안을 바꾸면 그날 날짜로 올린다 (화면엔 판을 보내지 않고 서버 값만 기록) */
	static final String TERMS_VERSION = "20261013";

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private static final DateTimeFormatter TERMS_AT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	/** 유일 제약 이름 → 오류 코드. 미리 확인해도 동시 가입 경쟁은 DB 만 잡을 수 있어서 */
	private static final Map<String, ErrorCode> CONSTRAINT_CODES = Map.of(
			"ux_trd_user_info_user_id", ErrorCode.DUPLICATE_LOGIN_ID,
			"ux_trd_user_info_nickname", ErrorCode.DUPLICATE_NICKNAME,
			"ux_trd_user_info_email", ErrorCode.DUPLICATE_EMAIL,
			"ux_trd_user_info_phone", ErrorCode.DUPLICATE_PHONE,
			"ux_trd_user_info_bus_reg_id", ErrorCode.DUPLICATE_BIZ_NO);

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final RateLimiter limiter;

	private final AppProperties props;

	/** 같은 클래스의 @Transactional 메서드는 프록시를 안 거쳐 트랜잭션이 안 걸리므로 템플릿으로 감싼다 */
	private final TransactionTemplate tx;

	private final StringRedisTemplate redis;

	private final Clock clock;

	public boolean isLoginIdAvailable(String loginId, String ip) {
		limiter.hit("signup:check:ip:" + ip, CHECK_PER_IP, CHECK_WINDOW);
		return !users.existsByLoginId(loginId);
	}

	public boolean isNicknameAvailable(String nickname, String ip) {
		limiter.hit("signup:check:ip:" + ip, CHECK_PER_IP, CHECK_WINDOW);
		return !users.existsByNicknameAndKind(nickname, UserKind.PERSONAL);
	}

	/**
	 * 일반 가입. trd_user_info 한 행으로 저장한다.
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

	/**
	 * 사업자번호 조회. 번호만 받는다 (사용자 지시, 2026-10-13).
	 * TODO(국세청 연동 전): 지금은 로컬 개발에서만 형식·중복만 보고 토큰을 발급한다. 연동하면 휴·폐업 확인을 여기에.
	 */
	public String verifyBusiness(BusinessVerifyRequest req, String ip) {
		limiter.hit("signup:biz-verify:ip:" + ip, SIGNUP_PER_IP, SIGNUP_WINDOW);
		if (!props.isLocal()) {
			throw new ApiException(ErrorCode.BUSINESS_VERIFICATION_UNAVAILABLE);
		}
		if (users.findByBusRegId(req.bizNo()).isPresent()) {
			throw new ApiException(ErrorCode.DUPLICATE_BIZ_NO);
		}
		String token = UUID.randomUUID().toString();
		redis.opsForValue().set(BUSINESS_VERIFY_PREFIX + token, req.bizNo(), BUSINESS_VERIFY_TTL);
		return token;
	}

	/** 사업자번호는 조회 토큰에서 가져오고, 계정·회사 정보는 trd_user_info 한 행에 저장한다. */
	public UUID signupBusiness(SignupBusinessRequest req, String ip) {
		limiter.hit("signup:ip:" + ip, SIGNUP_PER_IP, SIGNUP_WINDOW);
		// 한 페이지 폼이라 아이디 중복 같은 오류로 다시 제출하는 일이 흔하다. 토큰은 가입이 끝난 뒤에 지운다
		// (같은 토큰으로 두 번 가입되는 경쟁은 bus_reg_id 유일 제약이 막는다)
		String tokenKey = BUSINESS_VERIFY_PREFIX + req.verificationToken();
		String bizNo = redis.opsForValue().get(tokenKey);
		if (bizNo == null) {
			throw new ApiException(ErrorCode.VERIFICATION_EXPIRED);
		}
		checkOpenDate(req.startDate());
		String lowerPassword = req.password().toLowerCase(Locale.ROOT);
		if (lowerPassword.contains(req.loginId().toLowerCase(Locale.ROOT))) {
			throw new ValidationException(Map.of("password", "비밀번호에 아이디를 포함할 수 없습니다."));
		}
		if (lowerPassword.contains(bizNo)) {
			throw new ValidationException(Map.of("password", "비밀번호에 사업자등록번호를 포함할 수 없습니다."));
		}
		String email = req.contactEmail().trim().toLowerCase(Locale.ROOT);
		if (users.existsByBusRegId(bizNo)) {
			throw new ApiException(ErrorCode.DUPLICATE_BIZ_NO);
		}
		if (users.existsByLoginId(req.loginId())) {
			throw new ApiException(ErrorCode.DUPLICATE_LOGIN_ID);
		}
		if (users.existsByEmailIgnoreCaseActive(email)) {
			throw new ApiException(ErrorCode.DUPLICATE_EMAIL);
		}
		if (users.existsByPhone(req.contactPhone())) {
			throw new ApiException(ErrorCode.DUPLICATE_PHONE);
		}
		String passwordHash = passwordEncoder.encode(req.password());
		try {
			UUID userId = tx.execute(status -> users.save(User.builder()
				.kind(UserKind.BUSINESS)
				.loginId(req.loginId())
				.passwordHash(passwordHash)
				.name(req.contactName())
				.phone(req.contactPhone())
				.email(email)
				.busRegId(bizNo)
				.companyType("corporation".equals(req.bizType()) ? "corporate" : req.bizType())
				.companyName(req.companyName())
				.companyOpenDate(req.startDate())
				.companyTel(req.companyTel())
				.companyAddress(req.address())
				.nicknameUsage("N")
				.contactMethod(req.contactMethod())
				.spareCol(termsAgreement())
				.build()).getId());
			// 계정은 이미 만들어졌다. 토큰 정리가 실패해도 가입 성공을 500 으로 바꾸지 않는다 (30분 뒤 만료, 재사용은 유일 제약이 막음)
			try {
				redis.delete(tokenKey);
			}
			catch (RuntimeException e) {
				log.warn("사업자 조회 토큰 삭제 실패 userId={}", userId, e);
			}
			log.info("기업 가입 userId={} ip={}", userId, ip);
			return userId;
		}
		catch (DataIntegrityViolationException e) {
			throw duplicateFrom(e);
		}
	}

	/**
	 * 약관 동의 기록 "terms:<약관 판>@<동의 시각 UTC yyyyMMddHHmmss>". 동의 이력 테이블이 없어 spare_col(40자)에 축약한다
	 * (decisions.md 2026-09-28 단일 trd_user_info, 2026-10-13 약관). 요청의 동의 값은 DTO @AssertTrue 가 이미 확인했다.
	 */
	private String termsAgreement() {
		return "terms:" + TERMS_VERSION + "@" + LocalDateTime.now(clock.withZone(ZoneOffset.UTC)).format(TERMS_AT);
	}

	/** 개업년월일: 실제 있는 날짜, 한국 날짜로 오늘 이전. 시스템 시간대(컨테이너는 UTC)를 쓰면 한국 00~09시에 "오늘"이 하루 밀린다 */
	private void checkOpenDate(String yyyymmdd) {
		try {
			LocalDate date = LocalDate.parse(yyyymmdd, DateTimeFormatter.BASIC_ISO_DATE);
			if (!date.isBefore(LocalDate.now(clock.withZone(SEOUL)))) {
				throw new ValidationException(Map.of("startDate", "개업년월일은 오늘 이전 날짜여야 합니다."));
			}
		}
		catch (DateTimeParseException e) {
			throw new ValidationException(Map.of("startDate", "개업년월일이 올바른 날짜가 아닙니다."));
		}
	}

	private void checkDuplicates(String loginId, String nickname, String email, String phone, boolean useNickname) {
		if (users.existsByLoginId(loginId)) {
			throw new ApiException(ErrorCode.DUPLICATE_LOGIN_ID);
		}
		if (useNickname && users.existsByNicknameAndKind(nickname, UserKind.PERSONAL)) {
			throw new ApiException(ErrorCode.DUPLICATE_NICKNAME);
		}
		if (users.existsByEmailIgnoreCaseActive(email)) {
			throw new ApiException(ErrorCode.DUPLICATE_EMAIL);
		}
		if (users.existsByPhone(phone)) {
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
			.userAddress(req.address())
			.contactMethod(req.contactMethod())
			.spareCol(termsAgreement())
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
