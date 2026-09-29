package com.company.market.user.service;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import com.company.market.common.auth.JwtProvider;
import com.company.market.common.auth.RefreshSessionStore;
import com.company.market.common.auth.oauth.SocialProfile;
import com.company.market.common.config.AppProperties;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.user.domain.SocialAccount;
import com.company.market.user.domain.TermsAgreement;
import com.company.market.user.domain.TermsId;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.dto.LoginResult;
import com.company.market.user.repository.SocialAccountRepository;
import com.company.market.user.repository.TermsAgreementRepository;
import com.company.market.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 소셜 로그인의 우리 쪽 절반. 제공자 인증(OAuth 토큰 교환·프로필 조회)은 Spring Security 가 하고,
 * 그 결과(SocialProfile)를 받아 계정을 찾거나 가입 마무리로 보낸다 (decisions.md 2026-09-22 "계정은 사람당 하나").
 */
// @Service // 소셜 로그인을 다시 도입할 때 저장 구조와 함께 활성화
@RequiredArgsConstructor
public class OAuthLoginService {

	private static final Logger log = LoggerFactory.getLogger(OAuthLoginService.class);

	private static final List<TermsId> REQUIRED_TERMS = List.of(TermsId.SERVICE, TermsId.PRIVACY, TermsId.AGE);

	private final UserRepository users;

	private final SocialAccountRepository socialAccounts;

	private final TermsAgreementRepository terms;

	private final OAuthSignupStore signupStore;

	private final JwtProvider jwt;

	private final RefreshSessionStore sessions;

	private final AppProperties props;

	private final TransactionTemplate tx;

	private final RateLimiter limiter;

	/** 콜백 결과. 핸들러가 이걸 보고 리다이렉트 URL 을 고른다 */
	public sealed interface Outcome permits LoggedIn, NeedsSignup, Rejected {
	}

	public record LoggedIn(LoginResult result) implements Outcome {
	}

	public record NeedsSignup(String token, String suggestedNickname) implements Outcome {
	}

	/** method: 이미 가입된 방식 (kakao|naver|google|id|business). 안내 문구용 */
	public record Rejected(ErrorCode code, String method) implements Outcome {
	}

	/** @param flowHash 콜백을 완성한 브라우저의 oauth_flow 쿠키 해시 (가입 마무리 토큰에 묶임) */
	public Outcome handleCallback(SocialProfile profile, String flowHash) {
		Optional<SocialAccount> linked = socialAccounts.findByProviderAndProviderUserId(profile.provider(), profile.providerUserId());
		if (linked.isPresent()) {
			User user = linked.get().getUser();
			if (!user.isActive()) {
				log.warn("정지·탈퇴 계정 소셜 로그인 시도 userId={}", user.getId());
				return new Rejected(ErrorCode.ACCOUNT_SUSPENDED, null);
			}
			user.recordLogin();
			users.save(user);
			log.info("소셜 로그인 userId={} provider={}", user.getId(), profile.provider());
			return new LoggedIn(issue(user));
		}
		if (profile.email() == null) {
			// 이메일 없이는 중복 가입을 잡을 수 없다 (decisions.md 2026-09-22). 카카오 "선택 동의" 미체크가 여기로
			return new Rejected(ErrorCode.OAUTH_EMAIL_REQUIRED, null);
		}
		Optional<String> existingMethod = registeredMethod(profile.email());
		if (existingMethod.isPresent()) {
			return new Rejected(ErrorCode.EMAIL_ALREADY_REGISTERED, existingMethod.get());
		}
		return new NeedsSignup(signupStore.save(profile, flowHash), profile.name());
	}

	/**
	 * 가입 마무리 (약관 + 닉네임). 소셜은 비밀번호가 없어 "로그인하러 가기"가 성립하지 않으므로 여기서 바로 로그인시킨다
	 * (일반 가입과 다른 점, decisions.md 2026-09-22).
	 */
	/** @param flowHash 요청의 oauth_flow 쿠키 해시. 없거나 다르면 토큰이 있어도 만료로 취급 */
	public LoginResult complete(String token, String flowHash, String nickname, boolean marketingOptIn, String ip) {
		// 가입 시도와 같은 한도(IP 5회/시간). 토큰이 10분 살아 있는 동안 닉네임 중복 응답으로 닉네임을 훑지 못하게
		limiter.hit("signup:ip:" + ip, 5, Duration.ofHours(1));
		SocialProfile profile = signupStore.find(token, flowHash).orElseThrow(() -> new ApiException(ErrorCode.OAUTH_EXPIRED));
		if (users.existsByNicknameAndKindAndDeletedAtIsNull(nickname, UserKind.PERSONAL)) {
			throw new ApiException(ErrorCode.DUPLICATE_NICKNAME);
		}
		// 콜백 이후 10분 사이에 같은 이메일이 다른 방식으로 가입했을 수 있다
		if (registeredMethod(profile.email()).isPresent()) {
			throw new ApiException(ErrorCode.EMAIL_ALREADY_REGISTERED);
		}
		User user;
		try {
			user = tx.execute(status -> persist(profile, nickname, marketingOptIn, ip));
		}
		catch (DataIntegrityViolationException e) {
			String message = String.valueOf(e.getMostSpecificCause().getMessage());
			if (message.contains("ux_users_nickname_personal")) {
				throw new ApiException(ErrorCode.DUPLICATE_NICKNAME);
			}
			if (message.contains("ux_users_email") || message.contains("ux_social_accounts_provider_user")) {
				throw new ApiException(ErrorCode.EMAIL_ALREADY_REGISTERED);
			}
			throw e;
		}
		signupStore.delete(token);
		log.info("소셜 가입 userId={} provider={} ip={}", user.getId(), profile.provider(), ip);
		return issue(user);
	}

	/** 이메일이 이미 있으면 그 계정의 로그인 방식. 안내 문구("네이버로 가입된 이메일")에 쓴다 */
	private Optional<String> registeredMethod(String email) {
		return users.findByEmailIgnoreCaseActive(email).map(u -> socialAccounts.findByUserId(u.getId())
			.map(s -> s.getProvider().name().toLowerCase(Locale.ROOT))
			.orElse(u.getKind() == UserKind.BUSINESS ? "business" : "id"));
	}

	private User persist(SocialProfile profile, String nickname, boolean marketingOptIn, String ip) {
		User user = users.save(User.builder()
			.kind(UserKind.PERSONAL)
			.nickname(nickname)
			.email(profile.email().trim().toLowerCase(Locale.ROOT))
			.emailVerifiedAt(profile.emailVerified() ? Instant.now() : null)
			.marketingOptInAt(marketingOptIn ? Instant.now() : null)
			.build());
		socialAccounts.save(SocialAccount.builder()
			.user(user)
			.provider(profile.provider())
			.providerUserId(profile.providerUserId())
			.providerEmail(profile.email())
			.build());
		InetAddress address = parseIp(ip);
		String version = props.terms().version();
		for (TermsId id : REQUIRED_TERMS) {
			terms.save(TermsAgreement.builder().user(user).termsId(id).version(version).agreed(true).ip(address).build());
		}
		terms.save(TermsAgreement.builder().user(user).termsId(TermsId.MARKETING).version(version).agreed(marketingOptIn).ip(address).build());
		return user;
	}

	/** 소셜은 "로그인 유지"를 물을 화면이 없다. 앱 관례대로 유지(영구 쿠키) */
	private LoginResult issue(User user) {
		return new LoginResult(user.getId(), jwt.createAccessToken(user.getId(), user.getRole()), sessions.issue(user.getId(), true), true);
	}

	private static InetAddress parseIp(String ip) {
		try {
			return ip == null || ip.isBlank() ? null : InetAddress.getByName(ip);
		}
		catch (UnknownHostException e) {
			return null;
		}
	}

}
