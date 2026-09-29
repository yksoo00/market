package com.company.market.user.controller;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.oauth.OAuthLoginHandlers;
import com.company.market.common.auth.oauth.RedisAuthorizationRequestRepository;
import com.company.market.common.auth.oauth.SocialProfile;
import com.company.market.common.exception.ErrorCode;
import com.company.market.user.domain.SocialAccount;
import com.company.market.user.domain.SocialProvider;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.SocialAccountRepository;
import com.company.market.user.repository.UserRepository;
import com.company.market.user.service.OAuthLoginService;
import com.company.market.user.service.OAuthSignupStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.util.UriComponentsBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 소셜 로그인. 제공자 서버(토큰 교환)는 테스트에서 못 부르므로 그 앞(인가 시작)과 뒤(프로필 받은 이후)를 각각 검증한다.
 * 토큰 교환 구간은 실제 카카오 콘솔로 수동 확인 (PR 본문).
 */
@Disabled("소셜 로그인은 단일 users 테이블 전환 중 비활성화")
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OAuthApiTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	StringRedisTemplate redis;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	SocialAccountRepository socialAccounts;

	@Autowired
	OAuthLoginService service;

	@Autowired
	OAuthSignupStore signupStore;

	@Autowired
	RedisAuthorizationRequestRepository authRequests;

	@Autowired
	OAuthLoginHandlers handlers;

	@Autowired
	com.company.market.common.crypto.PiiHasher hasher;

	static final String FLOW = "flow-cookie-value";

	String flowHash() {
		return hasher.hash(FLOW);
	}

	static jakarta.servlet.http.Cookie flowCookie() {
		return new jakarta.servlet.http.Cookie("oauth_flow", FLOW);
	}

	static final SocialProfile KAKAO_PROFILE = new SocialProfile(SocialProvider.KAKAO, "k-1", "new@kakao.com", true, "길동");

	@AfterEach
	void tearDown() {
		jdbc.update("delete from terms_agreements where user_id in (select id from users where role <> 'admin')");
		jdbc.update("delete from social_accounts");
		jdbc.update("delete from users where role <> 'admin'");
		Objects.requireNonNull(redis.getConnectionFactory()).getConnection().serverCommands().flushDb();
	}

	/** Location 의 쿼리는 인코딩돼 있다 (state 의 '=' 가 %3D). 디코딩해서 돌려준다 */
	static Map<String, String> query(String url) {
		Map<String, String> decoded = new java.util.LinkedHashMap<>();
		UriComponentsBuilder.fromUriString(url).build().getQueryParams().toSingleValueMap()
			.forEach((k, v) -> decoded.put(k, java.net.URLDecoder.decode(v, java.nio.charset.StandardCharsets.UTF_8)));
		return decoded;
	}

	@Nested
	@DisplayName("인가 시작")
	class Authorize {

		@Test
		@DisplayName("GET /oauth/kakao?next=… → 카카오로 302, state 와 next 는 Redis 에")
		void redirectsToProvider() throws Exception {
			MvcResult r = mvc.perform(get("/api/v1/auth/oauth/kakao").param("next", "/listings/1")).andExpect(status().isFound()).andReturn();

			String location = Objects.requireNonNull(r.getResponse().getRedirectedUrl());
			assertThat(location).startsWith("https://kauth.kakao.com/oauth/authorize");
			Map<String, String> q = query(location);
			assertThat(q.get("client_id")).isEqualTo("test-kakao-id");
			assertThat(URI.create(q.get("redirect_uri")).getPath()).isEqualTo("/api/v1/auth/oauth/kakao/callback");
			assertThat(q.get("scope")).contains("account_email");
			assertThat(redis.hasKey("oauth:state:" + q.get("state"))).isTrue();
			assertThat(redis.opsForValue().get("oauth:state:" + q.get("state"))).contains("\"next\":\"/listings/1\"");
			// 시작한 브라우저 표식. 콜백은 이 쿠키가 있어야 완성된다
			String flow = r.getResponse().getHeaders("Set-Cookie").stream().filter(h -> h.startsWith("oauth_flow=")).findFirst().orElseThrow();
			assertThat(flow).contains("HttpOnly").contains("Secure").contains("Path=/api/v1/auth/oauth");
		}

		@Test
		@DisplayName("next 가 외부 URL 이면 / 로 바꿔 저장 (오픈 리다이렉트 방지)")
		void externalNextIsDropped() throws Exception {
			MvcResult r = mvc.perform(get("/api/v1/auth/oauth/google").param("next", "//evil.example/x")).andExpect(status().isFound()).andReturn();

			String state = query(Objects.requireNonNull(r.getResponse().getRedirectedUrl())).get("state");
			assertThat(redis.opsForValue().get("oauth:state:" + state)).contains("\"next\":\"/\"");
		}

		@Test
		@DisplayName("없는 제공자는 404 JSON, POST /oauth/complete 는 인가 시작으로 오인되지 않는다")
		void unknownProviderAndCompletePath() throws Exception {
			mvc.perform(get("/api/v1/auth/oauth/facebook")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
			mvc.perform(post("/api/v1/auth/oauth/complete").contentType(MediaType.APPLICATION_JSON)
					.content("{\"token\":\"nope\",\"nickname\":\"길동\",\"marketingOptIn\":false}"))
				.andExpect(status().isGone()).andExpect(jsonPath("$.code").value("OAUTH_EXPIRED"));
		}

		@Test
		@DisplayName("state 저장소 왕복: nonce 등 attribute 가 보존되고, 꺼내면 지워지며 next 가 request attribute 로 온다")
		void repositoryRoundTrip() {
			OAuth2AuthorizationRequest original = OAuth2AuthorizationRequest.authorizationCode()
				.clientId("cid").authorizationUri("https://p/authorize").redirectUri("http://localhost/cb")
				.scopes(Set.of("openid", "email")).state("st-1")
				.additionalParameters(Map.of("nonce", "n-hash")).attributes(Map.of("registration_id", "google", "nonce", "n-raw"))
				.authorizationRequestUri("https://p/authorize?x=y").build();
			MockHttpServletRequest start = new MockHttpServletRequest("GET", "/api/v1/auth/oauth/google");
			start.setParameter("next", "/me");
			MockHttpServletResponse startRes = new MockHttpServletResponse();
			authRequests.saveAuthorizationRequest(original, start, startRes);
			String flow = Objects.requireNonNull(startRes.getCookie("oauth_flow")).getValue();

			// 다른 브라우저(쿠키 없음)나 다른 값이면 못 꺼낸다 — 로그인 CSRF 방지
			MockHttpServletRequest foreign = new MockHttpServletRequest("GET", "/api/v1/auth/oauth/google/callback");
			foreign.setParameter("state", "st-1");
			assertThat(authRequests.loadAuthorizationRequest(foreign)).isNull();
			foreign.setCookies(new jakarta.servlet.http.Cookie("oauth_flow", "wrong"));
			assertThat(authRequests.removeAuthorizationRequest(foreign, new MockHttpServletResponse())).isNull();
			assertThat(redis.hasKey("oauth:state:st-1")).isTrue();

			MockHttpServletRequest callback = new MockHttpServletRequest("GET", "/api/v1/auth/oauth/google/callback");
			callback.setParameter("state", "st-1");
			callback.setCookies(new jakarta.servlet.http.Cookie("oauth_flow", flow));
			OAuth2AuthorizationRequest loaded = authRequests.removeAuthorizationRequest(callback, new MockHttpServletResponse());

			assertThat(loaded).isNotNull();
			assertThat(loaded.getAttributes()).containsEntry("nonce", "n-raw").containsEntry("registration_id", "google");
			assertThat(loaded.getAdditionalParameters()).containsEntry("nonce", "n-hash");
			assertThat(loaded.getScopes()).containsExactlyInAnyOrder("openid", "email");
			assertThat(callback.getAttribute(RedisAuthorizationRequestRepository.NEXT_ATTRIBUTE)).isEqualTo("/me");
			assertThat(callback.getAttribute(RedisAuthorizationRequestRepository.FLOW_HASH_ATTRIBUTE)).isEqualTo(hasher.hash(flow));
			assertThat(authRequests.loadAuthorizationRequest(callback)).isNull();
		}

	}

	@Nested
	@DisplayName("콜백 분기")
	class Callback {

		@Test
		@DisplayName("처음 보는 소셜 계정 + 새 이메일 → 가입 마무리 토큰 (프로필은 Redis 에만)")
		void newUserNeedsSignup() {
			OAuthLoginService.Outcome out = service.handleCallback(KAKAO_PROFILE, flowHash());

			assertThat(out).isInstanceOf(OAuthLoginService.NeedsSignup.class);
			OAuthLoginService.NeedsSignup s = (OAuthLoginService.NeedsSignup) out;
			assertThat(s.suggestedNickname()).isEqualTo("길동");
			assertThat(signupStore.find(s.token(), flowHash())).contains(KAKAO_PROFILE);
			assertThat(signupStore.find(s.token(), hasher.hash("other-browser"))).isEmpty();
			assertThat(jdbc.queryForObject("select count(*) from users where role <> 'admin'", Long.class)).isZero();
		}

		@Test
		@DisplayName("이미 연결된 소셜 계정 → 바로 로그인 (토큰 발급, last_login_at 갱신)")
		void linkedAccountLogsIn() {
			User user = users.save(User.builder().kind(UserKind.PERSONAL).nickname("기존").email("new@kakao.com").build());
			socialAccounts.save(SocialAccount.builder().user(user).provider(SocialProvider.KAKAO).providerUserId("k-1").build());

			OAuthLoginService.Outcome out = service.handleCallback(KAKAO_PROFILE, flowHash());

			assertThat(out).isInstanceOf(OAuthLoginService.LoggedIn.class);
			assertThat(((OAuthLoginService.LoggedIn) out).result().userId()).isEqualTo(user.getId());
			assertThat(jdbc.queryForObject("select last_login_at from users where id = ?", Object.class, user.getId())).isNotNull();
		}

		@Test
		@DisplayName("이메일이 아이디 계정으로 이미 있으면 EMAIL_ALREADY_REGISTERED + method=id, 네이버 계정이면 method=naver")
		void emailRegisteredElsewhere() {
			users.save(User.builder().kind(UserKind.PERSONAL).loginId("gildong1").passwordHash("h").nickname("길동").email("New@Kakao.com").build());
			OAuthLoginService.Outcome byId = service.handleCallback(KAKAO_PROFILE, flowHash());
			assertThat(byId).isEqualTo(new OAuthLoginService.Rejected(ErrorCode.EMAIL_ALREADY_REGISTERED, "id"));

			User naverUser = users.save(User.builder().kind(UserKind.PERSONAL).nickname("네이버").email("n@x.com").build());
			socialAccounts.save(SocialAccount.builder().user(naverUser).provider(SocialProvider.NAVER).providerUserId("n-1").build());
			OAuthLoginService.Outcome byNaver = service.handleCallback(new SocialProfile(SocialProvider.KAKAO, "k-2", "n@x.com", true, null), flowHash());
			assertThat(byNaver).isEqualTo(new OAuthLoginService.Rejected(ErrorCode.EMAIL_ALREADY_REGISTERED, "naver"));
		}

		@Test
		@DisplayName("이메일을 안 주면(카카오 미동의) OAUTH_EMAIL_REQUIRED, 정지된 계정은 ACCOUNT_SUSPENDED")
		void noEmailAndSuspended() {
			assertThat(service.handleCallback(new SocialProfile(SocialProvider.KAKAO, "k-3", null, false, "x"), flowHash()))
				.isEqualTo(new OAuthLoginService.Rejected(ErrorCode.OAUTH_EMAIL_REQUIRED, null));

			User user = users.save(User.builder().kind(UserKind.PERSONAL).nickname("정지").email("s@x.com").build());
			socialAccounts.save(SocialAccount.builder().user(user).provider(SocialProvider.GOOGLE).providerUserId("g-1").build());
			jdbc.update("update users set status = 'suspended' where id = ?", user.getId());
			assertThat(service.handleCallback(new SocialProfile(SocialProvider.GOOGLE, "g-1", "s@x.com", true, null), flowHash()))
				.isEqualTo(new OAuthLoginService.Rejected(ErrorCode.ACCOUNT_SUSPENDED, null));
		}

		@Test
		@DisplayName("콜백에 제공자가 error 를 실어 보내거나(동의 취소) state 가 없으면 /login?error=OAUTH_FAILED 로 (제공자 호출 없음)")
		void callbackErrorsRedirectToLogin() throws Exception {
			mvc.perform(get("/api/v1/auth/oauth/kakao/callback").param("error", "access_denied").param("state", "whatever"))
				.andExpect(status().isFound()).andExpect(header().string("Location", "http://localhost:3000/login?error=OAUTH_FAILED"));
			mvc.perform(get("/api/v1/auth/oauth/kakao/callback").param("code", "abc").param("state", "unknown-state"))
				.andExpect(status().isFound()).andExpect(header().string("Location", "http://localhost:3000/login?error=OAUTH_FAILED"));
		}

		@Test
		@DisplayName("로그인 성공 리다이렉트는 next 의 한글·공백을 인코딩한다 (Location 헤더는 ASCII 만)")
		void successRedirectEncodesNext() throws Exception {
			User user = users.save(User.builder().kind(UserKind.PERSONAL).nickname("기존").email("new@kakao.com").build());
			socialAccounts.save(SocialAccount.builder().user(user).provider(SocialProvider.KAKAO).providerUserId("k-1").build());
			MockHttpServletRequest req = new MockHttpServletRequest();
			req.setAttribute(RedisAuthorizationRequestRepository.NEXT_ATTRIBUTE, "/search?q=서버 랙");
			req.setAttribute(RedisAuthorizationRequestRepository.FLOW_HASH_ATTRIBUTE, flowHash());
			MockHttpServletResponse res = new MockHttpServletResponse();
			var principal = new org.springframework.security.oauth2.core.user.DefaultOAuth2User(List.of(), Map.of("id", "k-1",
					"kakao_account", Map.of("email", "new@kakao.com")), "id");

			handlers.onAuthenticationSuccess(req, res, new org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken(principal, List.of(), "kakao"));

			assertThat(res.getRedirectedUrl()).isEqualTo("http://localhost:3000/search?q=%EC%84%9C%EB%B2%84%20%EB%9E%99");
			assertThat(res.getCookie("access_token")).isNotNull();
			assertThat(Objects.requireNonNull(res.getCookie("oauth_flow")).getMaxAge()).isZero();
		}

		@Test
		@DisplayName("핸들러 리다이렉트: 실패는 /login?error=OAUTH_FAILED")
		void failureRedirect() throws Exception {
			MockHttpServletResponse res = new MockHttpServletResponse();
			handlers.onAuthenticationFailure(new MockHttpServletRequest(), res, new AuthenticationException("cancelled") {
			});

			assertThat(res.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?error=OAUTH_FAILED");
		}

	}

	@Nested
	@DisplayName("가입 마무리")
	class Complete {

		@Test
		@DisplayName("토큰 + 닉네임 → users·social_accounts·약관 4행, 쿠키 발급(자동 로그인), 토큰 삭제")
		void completesAndLogsIn() throws Exception {
			String token = signupStore.save(KAKAO_PROFILE, flowHash());

			// 콜백을 완성한 브라우저(oauth_flow 쿠키)가 아니면 토큰이 있어도 410
			mvc.perform(post("/api/v1/auth/oauth/complete").contentType(MediaType.APPLICATION_JSON)
					.content("{\"token\":\"" + token + "\",\"nickname\":\"길동이\",\"marketingOptIn\":false}"))
				.andExpect(status().isGone()).andExpect(jsonPath("$.code").value("OAUTH_EXPIRED"));

			MvcResult r = mvc.perform(post("/api/v1/auth/oauth/complete").contentType(MediaType.APPLICATION_JSON).cookie(flowCookie())
					.content("{\"token\":\"" + token + "\",\"nickname\":\"길동이\",\"marketingOptIn\":false}"))
				.andExpect(status().isCreated()).andReturn();

			UUID userId = UUID.fromString(r.getResponse().getContentAsString().replaceAll(".*\"userId\":\"([^\"]+)\".*", "$1"));
			Map<String, Object> u = jdbc.queryForMap("select kind, login_id, password_hash, nickname, email, email_verified_at, name, phone from users where id = ?", userId);
			assertThat(u.get("kind")).isEqualTo("personal");
			assertThat(u.get("login_id")).isNull();
			assertThat(u.get("password_hash")).isNull();
			assertThat(u.get("nickname")).isEqualTo("길동이");
			assertThat(u.get("email")).isEqualTo("new@kakao.com");
			assertThat(u.get("email_verified_at")).isNotNull();
			assertThat(u.get("name")).isNull();
			assertThat(u.get("phone")).isNull();
			Map<String, Object> s = jdbc.queryForMap("select provider, provider_user_id, provider_email from social_accounts where user_id = ?", userId);
			assertThat(s.get("provider")).isEqualTo("kakao");
			assertThat(s.get("provider_user_id")).isEqualTo("k-1");
			assertThat((String) s.get("provider_email")).doesNotContain("new@kakao.com");
			List<Map<String, Object>> t = jdbc.queryForList("select terms_id, agreed from terms_agreements where user_id = ?", userId);
			assertThat(t).hasSize(4);
			assertThat(r.getResponse().getCookie("access_token")).isNotNull();
			assertThat(r.getResponse().getCookie("refresh_token")).isNotNull();
			assertThat(signupStore.find(token, flowHash())).isEmpty();
			assertThat(Objects.requireNonNull(r.getResponse().getCookie("oauth_flow")).getMaxAge()).isZero();

			// 두 번째부터는 이 소셜 계정으로 바로 로그인
			assertThat(service.handleCallback(KAKAO_PROFILE, flowHash())).isInstanceOf(OAuthLoginService.LoggedIn.class);
		}

		@Test
		@DisplayName("닉네임 중복 409, 토큰 만료·위조 410, 검증 400")
		void errors() throws Exception {
			users.save(User.builder().kind(UserKind.PERSONAL).loginId("other01").passwordHash("h").nickname("길동이").email("o@x.com").build());
			String token = signupStore.save(KAKAO_PROFILE, flowHash());

			mvc.perform(post("/api/v1/auth/oauth/complete").contentType(MediaType.APPLICATION_JSON).cookie(flowCookie())
					.content("{\"token\":\"" + token + "\",\"nickname\":\"길동이\",\"marketingOptIn\":false}"))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_NICKNAME"));
			mvc.perform(post("/api/v1/auth/oauth/complete").contentType(MediaType.APPLICATION_JSON).cookie(flowCookie())
					.content("{\"token\":\"forged\",\"nickname\":\"새닉\",\"marketingOptIn\":false}"))
				.andExpect(status().isGone()).andExpect(jsonPath("$.code").value("OAUTH_EXPIRED"));
			mvc.perform(post("/api/v1/auth/oauth/complete").contentType(MediaType.APPLICATION_JSON).cookie(flowCookie())
					.content("{\"token\":\"" + token + "\",\"nickname\":\"a\",\"marketingOptIn\":false}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.nickname").isString());
		}

		@Test
		@DisplayName("콜백 뒤 10분 사이에 같은 이메일이 다른 방식으로 가입했으면 409 EMAIL_ALREADY_REGISTERED")
		void emailTakenMeanwhile() throws Exception {
			String token = signupStore.save(KAKAO_PROFILE, flowHash());
			users.save(User.builder().kind(UserKind.PERSONAL).loginId("fast01").passwordHash("h").nickname("빠른이").email("new@kakao.com").build());

			mvc.perform(post("/api/v1/auth/oauth/complete").contentType(MediaType.APPLICATION_JSON).cookie(flowCookie())
					.content("{\"token\":\"" + token + "\",\"nickname\":\"길동이\",\"marketingOptIn\":true}"))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));
		}

	}

}
