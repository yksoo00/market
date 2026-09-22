package com.company.market.user.controller;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 일반 가입 (본인인증 stub). 테스트 프로필은 app.identity-verification.provider=stub */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SignupApiTest {

	static final String STUB_TOKEN = "stub-verification-token";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	StringRedisTemplate redis;

	@Autowired
	PiiHasher hasher;

	@AfterEach
	void tearDown() {
		jdbc.update("delete from terms_agreements where user_id in (select id from users where role <> 'admin')");
		jdbc.update("delete from identity_verifications");
		jdbc.update("delete from users where role <> 'admin'");
		Objects.requireNonNull(redis.getConnectionFactory()).getConnection().serverCommands().flushDb();
	}

	/** 기본값은 전부 유효. 바꿀 것만 override */
	static String body(Map<String, Object> override) {
		Map<String, Object> m = new java.util.LinkedHashMap<>(Map.of(
				"verificationToken", STUB_TOKEN, "name", "홍길동", "nickname", "길동이", "loginId", "gildong1",
				"email", "gildong@example.com", "password", "Str0ng-pass!", "phone", "01012345678", "marketingOptIn", true));
		m.putAll(override);
		StringBuilder sb = new StringBuilder("{");
		m.forEach((k, v) -> sb.append('"').append(k).append("\":").append(v instanceof String s ? '"' + s + '"' : v).append(','));
		sb.setLength(sb.length() - 1);
		return sb.append('}').toString();
	}

	MockHttpServletRequestBuilder signup(Map<String, Object> override) {
		return post("/api/v1/auth/signup/personal").contentType(MediaType.APPLICATION_JSON).content(body(override));
	}

	MockHttpServletRequestBuilder signupFrom(String ip, Map<String, Object> override) {
		return signup(override).with(r -> { r.setRemoteAddr(ip); return r; });
	}

	@Nested
	@DisplayName("가입 성공")
	class Success {

		@Test
		@DisplayName("users·identity_verifications·terms_agreements×4 가 생기고, 이름·휴대폰·CI 는 암호화, 이메일은 소문자")
		void createsAllRows() throws Exception {
			MvcResult r = mvc.perform(signup(Map.of("email", "GilDong@Example.com"))).andExpect(status().isCreated())
				.andExpect(jsonPath("$.ok").value(true)).andReturn();
			UUID userId = UUID.fromString(r.getResponse().getContentAsString().replaceAll(".*\"userId\":\"([^\"]+)\".*", "$1"));

			Map<String, Object> u = jdbc.queryForMap("select kind, login_id, nickname, email, name, phone, phone_hash, password_hash, marketing_opt_in_at from users where id = ?", userId);
			assertThat(u.get("kind")).isEqualTo("personal");
			assertThat(u.get("login_id")).isEqualTo("gildong1");
			assertThat(u.get("email")).isEqualTo("gildong@example.com");
			assertThat((String) u.get("name")).doesNotContain("홍길동");
			assertThat((String) u.get("phone")).doesNotContain("01012345678");
			assertThat(u.get("phone_hash")).isEqualTo(hasher.hash("01012345678"));
			assertThat((String) u.get("password_hash")).startsWith("$2a$12$").doesNotContain("Str0ng");
			assertThat(u.get("marketing_opt_in_at")).isNotNull();

			Map<String, Object> v = jdbc.queryForMap("select provider, ci, ci_hash from identity_verifications where user_id = ?", userId);
			assertThat(v.get("provider")).isEqualTo("stub");
			assertThat((String) v.get("ci")).doesNotContain("stub-ci:");
			assertThat(v.get("ci_hash")).isEqualTo(hasher.hash("stub-ci:" + hasher.hash("stub:01012345678")));

			var termsRows = jdbc.queryForList("select terms_id, agreed, version, ip from terms_agreements where user_id = ? order by terms_id", userId);
			assertThat(termsRows).hasSize(4);
			assertThat(termsRows).extracting(row -> row.get("terms_id")).containsExactly("age", "marketing", "privacy", "service");
			assertThat(termsRows).allSatisfy(row -> {
				assertThat(row.get("version")).isEqualTo("2026-09-22-draft");
				assertThat(row.get("ip")).isNotNull();
			});
			assertThat(termsRows.stream().filter(row -> "marketing".equals(row.get("terms_id"))).findFirst().orElseThrow().get("agreed")).isEqualTo(true);
		}

		@Test
		@DisplayName("마케팅 미동의도 agreed=false 행으로 남는다 (거부 증빙)")
		void marketingDeclinedIsRecorded() throws Exception {
			mvc.perform(signup(Map.of("marketingOptIn", false))).andExpect(status().isCreated());

			assertThat(jdbc.queryForObject("select agreed from terms_agreements t join users u on u.id = t.user_id where u.login_id = 'gildong1' and t.terms_id = 'marketing'", Boolean.class)).isFalse();
			assertThat(jdbc.queryForObject("select marketing_opt_in_at from users where login_id = 'gildong1'", Object.class)).isNull();
		}

		@Test
		@DisplayName("가입 직후 그 아이디·비밀번호로 로그인된다")
		void canLoginAfterSignup() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated());

			mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"loginId":"gildong1","password":"Str0ng-pass!","remember":true}"""))
				.andExpect(status().isOk());
		}

	}

	@Nested
	@DisplayName("중복")
	class Duplicates {

		@Test
		@DisplayName("아이디·닉네임·이메일(대소문자 무시)·휴대폰 중복은 각자 409 코드")
		void eachDuplicateHasItsCode() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated());

			// 두 번째 가입은 다른 사람(다른 휴대폰 → 다른 CI)이어야 ALREADY_REGISTERED 에 먼저 걸리지 않는다
			Map<String, Object> other = Map.of("nickname", "다른이", "loginId", "other01", "email", "other@example.com", "phone", "01099998888");
			mvc.perform(signup(with(other, "loginId", "gildong1"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_LOGIN_ID"));
			mvc.perform(signup(with(other, "nickname", "길동이"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_NICKNAME"));
			mvc.perform(signup(with(other, "email", "GILDONG@EXAMPLE.COM"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
		}

		@Test
		@DisplayName("같은 사람(CI)이 다시 가입하면 ALREADY_REGISTERED — 아이디 찾기 안내")
		void samePersonIsAlreadyRegistered() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated());

			mvc.perform(signup(Map.of("nickname", "다른이", "loginId", "other01", "email", "other@example.com")))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_REGISTERED"));
		}

		@Test
		@DisplayName("중복확인 API: 쓰고 있으면 available=false, 형식이 틀리면 400")
		void checkApis() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated());

			mvc.perform(post("/api/v1/auth/signup/check-login-id").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":\"gildong1\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false));
			mvc.perform(post("/api/v1/auth/signup/check-login-id").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":\"newone9\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(true));
			mvc.perform(post("/api/v1/auth/signup/check-login-id").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":\"1bad\"}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.loginId").isString());
			mvc.perform(post("/api/v1/auth/signup/check-nickname").contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"길동이\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(false));
		}

		static Map<String, Object> with(Map<String, Object> base, String key, Object value) {
			Map<String, Object> m = new java.util.LinkedHashMap<>(base);
			m.put(key, value);
			return m;
		}

	}

	@Nested
	@DisplayName("검증")
	class Validation {

		@Test
		@DisplayName("규칙 위반은 400 VALIDATION 과 필드별 문구 (security.md 표)")
		void fieldRules() throws Exception {
			mvc.perform(signup(Map.of("loginId", "Ab1", "password", "short", "phone", "0212345678", "name", "홍", "email", "not-an-email", "nickname", "a")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION"))
				.andExpect(jsonPath("$.fields.loginId").isString())
				.andExpect(jsonPath("$.fields.password").isString())
				.andExpect(jsonPath("$.fields.phone").isString())
				.andExpect(jsonPath("$.fields.name").isString())
				.andExpect(jsonPath("$.fields.email").isString())
				.andExpect(jsonPath("$.fields.nickname").isString());
			assertThat(jdbc.queryForObject("select count(*) from users where role <> 'admin'", Long.class)).isZero();
		}

		@Test
		@DisplayName("비밀번호에 아이디가 들어가면 400, fields.password")
		void passwordContainsLoginId() throws Exception {
			mvc.perform(signup(Map.of("password", "Gildong1-pass!")))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION")).andExpect(jsonPath("$.fields.password").isString());
		}

		@Test
		@DisplayName("stub 토큰이 아니면 VERIFICATION_EXPIRED")
		void wrongToken() throws Exception {
			mvc.perform(signup(Map.of("verificationToken", "something-else"))).andExpect(status().isGone())
				.andExpect(jsonPath("$.code").value("VERIFICATION_EXPIRED"));
		}

	}

	@Test
	@DisplayName("중복확인은 같은 IP 에서 분당 30회까지 — 아이디 존재 여부 훑기 방지")
	void checkApisRateLimited() throws Exception {
		for (int i = 0; i < 30; i++) {
			mvc.perform(post("/api/v1/auth/signup/check-login-id").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":\"probe" + i + "\"}")
				.with(r -> { r.setRemoteAddr("10.7.7.7"); return r; })).andExpect(status().isOk());
		}

		mvc.perform(post("/api/v1/auth/signup/check-nickname").contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"아무거나\"}")
				.with(r -> { r.setRemoteAddr("10.7.7.7"); return r; }))
			.andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
	}

	@Test
	@DisplayName("같은 IP 에서 6번째 가입 시도는 429 (5회/시간)")
	void rateLimitedPerIp() throws Exception {
		for (int i = 0; i < 5; i++) {
			// 검증 실패(VERIFICATION_EXPIRED)도 시도로 센다 — 비용이 드는 건 시도 자체라서
			mvc.perform(signupFrom("10.9.9.9", Map.of("verificationToken", "x"))).andExpect(status().isGone());
		}

		mvc.perform(signupFrom("10.9.9.9", Map.of())).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
		mvc.perform(signupFrom("10.9.9.10", Map.of())).andExpect(status().isCreated());
	}

}
