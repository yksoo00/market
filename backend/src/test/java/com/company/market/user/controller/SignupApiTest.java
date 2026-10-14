package com.company.market.user.controller;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
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

/** 가입 API (일반·기업). 약관 동의는 서버도 확인한다 (2026-10-13) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SignupApiTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	StringRedisTemplate redis;

	@AfterEach
	void tearDown() {
		jdbc.update("delete from trd_user_info");
		Objects.requireNonNull(redis.getConnectionFactory()).getConnection().serverCommands().flushDb();
	}

	/** 기본값은 전부 유효. 바꿀 것만 override */
	static String body(Map<String, Object> override) {
		Map<String, Object> m = new java.util.LinkedHashMap<>(Map.of(
				"name", "홍길동", "nickname", "길동이", "nicknameUsage", "Y", "loginId", "gildong1",
				"email", "gildong@example.com", "password", "Str0ng-pass!", "phone", "01012345678", "contactMethod", "1"));
		// Map.of 는 10쌍까지라 약관 동의는 따로
		m.put("agreeTerms", true);
		m.put("agreePrivacy", true);
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
		@DisplayName("사용자 제공 단일 users 행에 계정 정보를 저장한다")
		void createsAllRows() throws Exception {
			MvcResult r = mvc.perform(signup(Map.of("email", "GilDong@Example.com"))).andExpect(status().isCreated())
				.andExpect(jsonPath("$.ok").value(true)).andReturn();
			UUID userId = UUID.fromString(r.getResponse().getContentAsString().replaceAll(".*\"userId\":\"([^\"]+)\".*", "$1"));

			Map<String, Object> u = jdbc.queryForMap("select user_class, user_id, user_nickname, nickname_usage, contact_method, user_email, user_name, user_phone, password, spare_col from trd_user_info where uid = ?", userId);
			assertThat(u.get("user_class")).isEqualTo("personal");
			assertThat(u.get("user_id")).isEqualTo("gildong1");
			assertThat(u.get("user_email")).isEqualTo("gildong@example.com");
			assertThat(u.get("user_name")).isEqualTo("홍길동");
			assertThat(u.get("user_phone")).isEqualTo("01012345678");
			assertThat(u.get("user_nickname")).isEqualTo("길동이");
			assertThat(u.get("nickname_usage")).isEqualTo("Y");
			assertThat(u.get("contact_method")).isEqualTo("1");
			assertThat((String) u.get("password")).startsWith("$2a$12$").doesNotContain("Str0ng");
			// 약관 동의 기록: 판 + 동의 시각(UTC yyyyMMddHHmmss)
			assertThat((String) u.get("spare_col")).matches("terms:20261014@\\d{14}");
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

		@Test
		@DisplayName("예전 클라이언트가 보내는 tel·contactTel 은 무시하고 가입에 성공한다 (기업 가입 본문의 contactTel 도 아래 기업 테스트가 같이 보낸다)")
		void legacyTelFieldsAreIgnored() throws Exception {
			mvc.perform(signup(Map.of("tel", "0212345678"))).andExpect(status().isCreated());
		}

	}

	@Nested
	@DisplayName("중복")
	class Duplicates {

		@Test
		@DisplayName("아이디·닉네임·이메일(대소문자 무시)·휴대폰 중복은 각자 409 코드")
		void eachDuplicateHasItsCode() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated());

			// 나머지 값은 겹치지 않게 해 검사하려는 필드 하나만 중복되도록
			Map<String, Object> other = Map.of("nickname", "다른이", "loginId", "other01", "email", "other@example.com", "phone", "01099998888");
			mvc.perform(signup(with(other, "loginId", "gildong1"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_LOGIN_ID"));
			mvc.perform(signup(with(other, "nickname", "길동이"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_NICKNAME"));
			mvc.perform(signup(with(other, "email", "GILDONG@EXAMPLE.COM"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
		}

		@Test
		@DisplayName("같은 아이디로 두 번 가입하면 409")
		void sameLoginIdTwice() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated());

			mvc.perform(signup(Map.of("nickname", "다른이", "email", "other@example.com", "phone", "01099998888")))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_LOGIN_ID"));
		}

		@Test
		@DisplayName("같은 휴대폰으로 다시 가입하면 중복으로 거부")
		void samePhoneIsAlreadyRegistered() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated());

			mvc.perform(signup(Map.of("nickname", "다른이", "loginId", "other01", "email", "other@example.com")))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_PHONE"));
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
			assertThat(jdbc.queryForObject("select count(*) from trd_user_info", Long.class)).isZero();
		}

		@Test
		@DisplayName("비밀번호에 아이디가 들어가면 400, fields.password")
		void passwordContainsLoginId() throws Exception {
			mvc.perform(signup(Map.of("password", "Gildong1-pass!")))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION")).andExpect(jsonPath("$.fields.password").isString());
		}

		@Test
		@DisplayName("약관에 동의하지 않으면 400, fields.agreeTerms·agreePrivacy — 프론트를 믿지 않는다")
		void termsRequired() throws Exception {
			mvc.perform(signup(Map.of("agreeTerms", false, "agreePrivacy", false)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.agreeTerms").isString())
				.andExpect(jsonPath("$.fields.agreePrivacy").isString());
		}

		@Test
		@DisplayName("별명 사용(Y)인데 별명이 비었으면 400, fields.nickname")
		void nicknameRequiredWhenUsed() throws Exception {
			Map<String, Object> noNickname = new java.util.HashMap<>();
			noNickname.put("nickname", null);  // "" 는 @Size 에서 먼저 걸려 서비스 규칙까지 안 감
			mvc.perform(signup(noNickname))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION")).andExpect(jsonPath("$.fields.nickname").isString());
		}

	}

	@Nested
	@DisplayName("기업 가입")
	class Business {

		String verify(String bizNo) throws Exception {
			MvcResult r = mvc.perform(post("/api/v1/auth/signup/business/verify").contentType(MediaType.APPLICATION_JSON)
					.content("{\"bizNo\":\"" + bizNo + "\"}"))
				.andExpect(status().isOk()).andReturn();
			return r.getResponse().getContentAsString().replaceAll(".*\"verificationToken\":\"([^\"]+)\".*", "$1");
		}

		MockHttpServletRequestBuilder signupBusiness(String token, String loginId, boolean agree) {
			return signupBusiness(token, loginId, agree, "20200101");
		}

		MockHttpServletRequestBuilder signupBusiness(String token, String loginId, boolean agree, String startDate) {
			return post("/api/v1/auth/signup/business").contentType(MediaType.APPLICATION_JSON).content("""
					{"verificationToken":"%s","loginId":"%s","password":"Str0ng-pass!","bizType":"corporation",
					 "companyName":"테스트상사","startDate":"%s","address":"서울 중구 세종대로 110 3층","contactName":"김담당",
					 "contactPhone":"01055556666","contactEmail":"owner@biz.example","contactTel":"0212345678","companyTel":"",
					 "contactMethod":"3","agreeTerms":%s,"agreePrivacy":%s}""".formatted(token, loginId, startDate, agree, agree));
		}

		@Test
		@DisplayName("사업자번호만으로 조회하고, 정한 아이디로 가입해 기업 로그인한다")
		void verifyByBizNoAndLoginById() throws Exception {
			String token = verify("1234567890");
			MvcResult r = mvc.perform(signupBusiness(token, "acme01", true)).andExpect(status().isCreated()).andReturn();
			UUID userId = UUID.fromString(r.getResponse().getContentAsString().replaceAll(".*\"userId\":\"([^\"]+)\".*", "$1"));

			Map<String, Object> u = jdbc.queryForMap("select user_class, user_id, bus_reg_id, spare_col, company_open_date, contact_method, user_address, company_address from trd_user_info where uid = ?", userId);
			assertThat(u.get("user_class")).isEqualTo("business");
			assertThat(u.get("user_id")).isEqualTo("acme01");
			assertThat(u.get("bus_reg_id")).isEqualTo("1234567890");
			assertThat((String) u.get("spare_col")).startsWith("terms:20261014@");
			assertThat(u.get("company_open_date")).isEqualTo("20200101");
			assertThat(u.get("contact_method")).isEqualTo("3");
			// 담당자 주소는 받지 않는다 (사용자 지시) — 주소는 회사 주소에만
			assertThat(u.get("user_address")).isNull();
			assertThat(u.get("company_address")).isEqualTo("서울 중구 세종대로 110 3층");

			mvc.perform(post("/api/v1/auth/login/business").contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"loginId":"acme01","password":"Str0ng-pass!","remember":false}"""))
				.andExpect(status().isOk());
			// 기업 계정은 개인 탭(일반 로그인)으로 안 된다
			mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"loginId":"acme01","password":"Str0ng-pass!","remember":false}"""))
				.andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("아이디 중복으로 거부돼도 조회를 다시 하지 않고 아이디만 고쳐 가입한다")
		void tokenSurvivesRejectedSubmit() throws Exception {
			mvc.perform(signup(Map.of())).andExpect(status().isCreated()); // gildong1 선점
			String token = verify("1234567890");

			mvc.perform(signupBusiness(token, "gildong1", true)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_LOGIN_ID"));
			mvc.perform(signupBusiness(token, "acme01", true)).andExpect(status().isCreated());
			// 가입이 끝난 토큰은 다시 못 쓴다
			mvc.perform(signupBusiness(token, "acme02", true)).andExpect(status().isGone()).andExpect(jsonPath("$.code").value("VERIFICATION_EXPIRED"));
		}

		@Test
		@DisplayName("사업자번호 형식·약관 미동의·개업년월일(형식, 오늘 이후)은 400 과 그 필드")
		void validation() throws Exception {
			mvc.perform(post("/api/v1/auth/signup/business/verify").contentType(MediaType.APPLICATION_JSON).content("{\"bizNo\":\"12345\"}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.bizNo").isString());
			mvc.perform(signupBusiness(verify("1234567890"), "acme01", false))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.agreeTerms").isString());
			// 개업년월일: 형식은 Bean Validation, 오늘 이후는 서비스(한국 날짜)
			String token = verify("1234567891");
			mvc.perform(signupBusiness(token, "acme01", true, "2020-01-01"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.startDate").isString());
			mvc.perform(signupBusiness(token, "acme01", true, "29991231"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.startDate").isString());
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
			// 서비스 검증 실패(비밀번호에 아이디 포함)도 시도로 센다 — 비용이 드는 건 시도 자체라서
			mvc.perform(signupFrom("10.9.9.9", Map.of("password", "Gildong1-pass!"))).andExpect(status().isBadRequest());
		}

		mvc.perform(signupFrom("10.9.9.9", Map.of())).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
		mvc.perform(signupFrom("10.9.9.10", Map.of())).andExpect(status().isCreated());
	}

}
