package com.company.market.user.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

import com.company.market.TestInfraConfiguration;
import com.company.market.organization.domain.BizType;
import com.company.market.organization.domain.Organization;
import com.company.market.organization.domain.OrganizationMember;
import com.company.market.organization.repository.OrganizationMemberRepository;
import com.company.market.organization.repository.OrganizationRepository;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.domain.UserRole;
import com.company.market.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 로그인 → refresh → 로그아웃 → 내 정보. 실제 Postgres·Redis 위에서 HTTP 경계까지 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class AuthApiTest {

	static final String PASSWORD = "Correct-horse-1!";

	static final String APP_ORIGIN = "http://localhost:3000";

	@Autowired
	MockMvc mvc;

	@Autowired
	UserRepository users;

	@Autowired
	OrganizationRepository organizations;

	@Autowired
	OrganizationMemberRepository members;

	@Autowired
	PasswordEncoder passwordEncoder;

	@Autowired
	StringRedisTemplate redis;

	@Autowired
	JdbcTemplate jdbc;

	User personal;

	@BeforeEach
	void setUp() {
		personal = users.save(User.builder()
			.kind(UserKind.PERSONAL)
			.loginId("tester1")
			.passwordHash(passwordEncoder.encode(PASSWORD))
			.nickname("테스터")
			.email("tester1@example.com")
			.build());
	}

	@AfterEach
	void tearDown() {
		jdbc.update("delete from organization_members");
		jdbc.update("delete from organizations");
		jdbc.update("delete from users where role <> 'admin'");
		Objects.requireNonNull(redis.getConnectionFactory()).getConnection().serverCommands().flushDb();
	}

	// --- helpers ---

	MockHttpServletRequestBuilder loginRequest(String loginId, String password, boolean remember) {
		// Origin 없음 = Bruno·서버 간 호출. 브라우저 출처 검사는 아래 CSRF 테스트에서
		return post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"loginId":"%s","password":"%s","remember":%s}""".formatted(loginId, password, remember));
	}

	MvcResult loginOk() throws Exception {
		return mvc.perform(loginRequest("tester1", PASSWORD, true)).andExpect(status().isOk()).andReturn();
	}

	static String cookieValue(MvcResult result, String name) {
		Cookie c = result.getResponse().getCookie(name);
		return c == null ? null : c.getValue();
	}

	static String setCookieHeader(MvcResult result, String name) {
		List<String> headers = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
		return headers.stream().filter(h -> h.startsWith(name + "=")).findFirst().orElseThrow();
	}

	@Nested
	@DisplayName("로그인")
	class Login {

		@Test
		@DisplayName("성공하면 userId 와 httpOnly·Secure·Lax 쿠키 두 개를 준다")
		void success() throws Exception {
			MvcResult r = loginOk();

			assertThat(r.getResponse().getContentAsString()).contains("\"ok\":true").contains(personal.getId().toString());
			String access = setCookieHeader(r, "access_token");
			String refresh = setCookieHeader(r, "refresh_token");
			assertThat(access).contains("HttpOnly").contains("Secure").contains("SameSite=Lax").contains("Path=/;").doesNotContain("Domain=");
			assertThat(refresh).contains("HttpOnly").contains("Secure").contains("Path=/api/v1/auth").contains("Max-Age=");
			assertThat(cookieValue(r, "refresh_token")).startsWith(personal.getId().toString() + ".");
		}

		@Test
		@DisplayName("remember 가 아니면 refresh 는 세션 쿠키(Max-Age 없음)")
		void sessionCookieWithoutRemember() throws Exception {
			MvcResult r = mvc.perform(loginRequest("tester1", PASSWORD, false)).andExpect(status().isOk()).andReturn();

			assertThat(setCookieHeader(r, "refresh_token")).doesNotContain("Max-Age");
		}

		@Test
		@DisplayName("비밀번호가 틀리든 아이디가 없든 같은 401 INVALID_CREDENTIALS")
		void wrongCredentialsLookTheSame() throws Exception {
			String wrongPw = mvc.perform(loginRequest("tester1", "nope-nope-1!", true)).andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS")).andReturn().getResponse().getContentAsString();
			String noUser = mvc.perform(loginRequest("nobody9", PASSWORD, true)).andExpect(status().isUnauthorized())
				.andReturn().getResponse().getContentAsString();

			assertThat(noUser).isEqualTo(wrongPw);
		}

		@Test
		@DisplayName("입력이 비면 400 VALIDATION 과 필드별 문구")
		void validation() throws Exception {
			mvc.perform(loginRequest("", "", true))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.ok").value(false))
				.andExpect(jsonPath("$.code").value("VALIDATION"))
				.andExpect(jsonPath("$.fields.loginId").isString())
				.andExpect(jsonPath("$.fields.password").isString());
		}

		@Test
		@DisplayName("5회 실패하면 맞는 비밀번호로도 429 LOCKED")
		void lockAfterFiveFailures() throws Exception {
			for (int i = 0; i < 5; i++) {
				mvc.perform(loginRequest("tester1", "wrong-wrong-1!", true)).andExpect(status().isUnauthorized());
			}

			mvc.perform(loginRequest("tester1", PASSWORD, true)).andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("LOCKED"));
		}

		@Test
		@DisplayName("정지된 계정은 비밀번호가 맞아도 403 ACCOUNT_SUSPENDED")
		void suspended() throws Exception {
			jdbc.update("update users set status = 'suspended' where id = ?", personal.getId());

			mvc.perform(loginRequest("tester1", PASSWORD, true)).andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
		}

		@Test
		@DisplayName("우리 프론트 출처의 POST 는 통과, 다른 출처는 403 (CSRF)")
		void originCheck() throws Exception {
			mvc.perform(loginRequest("tester1", PASSWORD, true).header(HttpHeaders.ORIGIN, APP_ORIGIN)).andExpect(status().isOk());
			mvc.perform(loginRequest("tester1", PASSWORD, true).header(HttpHeaders.ORIGIN, "https://evil.example"))
				.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
		}

	}

	@Nested
	@DisplayName("기업 로그인")
	class BusinessLogin {

		@Test
		@DisplayName("사업자번호 + 담당자 비밀번호로 로그인된다")
		void success() throws Exception {
			User owner = users.save(User.builder().kind(UserKind.BUSINESS).passwordHash(passwordEncoder.encode(PASSWORD))
				.nickname("테스트상사").email("owner@biz.example").build());
			Organization org = organizations.save(Organization.builder().bizNo("1234567890").name("테스트상사").ownerName("대표")
				.startDate(LocalDate.of(2020, 1, 1)).bizType(BizType.CORPORATION).address("서울").build());
			members.save(OrganizationMember.builder().organization(org).user(owner).build());

			mvc.perform(post("/api/v1/auth/login/business").contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"bizNo":"1234567890","password":"%s","remember":true}""".formatted(PASSWORD)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.userId").value(owner.getId().toString()));
		}

		@Test
		@DisplayName("등록되지 않은 사업자번호는 401 INVALID_CREDENTIALS")
		void unknownBizNo() throws Exception {
			mvc.perform(post("/api/v1/auth/login/business").contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"bizNo":"9999999999","password":"%s","remember":true}""".formatted(PASSWORD)))
				.andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
		}

	}

	@Nested
	@DisplayName("refresh")
	class Refresh {

		@Test
		@DisplayName("회전: 새 토큰을 준다. 유예(30초) 지난 옛 토큰 재사용은 탈취로 보고 새 토큰까지 무효화")
		void rotationAndReuseDetection() throws Exception {
			String first = cookieValue(loginOk(), "refresh_token");

			MvcResult r2 = mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", first)))
				.andExpect(status().isOk()).andReturn();
			String second = cookieValue(r2, "refresh_token");
			assertThat(second).isNotEqualTo(first);
			assertThat(cookieValue(r2, "access_token")).isNotBlank();

			// 30초 유예가 지난 상황: 직전 해시 키를 지운다
			redis.delete(redis.keys("session:*:prev"));
			// 옛 토큰 재사용 → 401, 그리고 그 사용자의 세션 전부 삭제
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", first))).andExpect(status().isUnauthorized());
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", second))).andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("회전 직후 30초 안에 옛 토큰이 다시 오면(탭 여러 개가 동시에 refresh) 탈취로 보지 않고 새 토큰을 준다")
		void graceForParallelRefresh() throws Exception {
			String first = cookieValue(loginOk(), "refresh_token");
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", first))).andExpect(status().isOk());

			MvcResult again = mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", first))).andExpect(status().isOk()).andReturn();
			// 세션은 살아 있다: 방금 받은 토큰으로 계속 회전 가능
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", cookieValue(again, "refresh_token")))).andExpect(status().isOk());
		}

		@Test
		@DisplayName("remember 없이 로그인했으면 회전 뒤에도 세션 쿠키로 유지된다")
		void keepsSessionCookieAcrossRotation() throws Exception {
			MvcResult login = mvc.perform(loginRequest("tester1", PASSWORD, false)).andExpect(status().isOk()).andReturn();

			MvcResult r = mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", cookieValue(login, "refresh_token"))))
				.andExpect(status().isOk()).andReturn();
			assertThat(setCookieHeader(r, "refresh_token")).doesNotContain("Max-Age");
		}

		@Test
		@DisplayName("쿠키가 없거나 깨졌으면 401")
		void missingOrGarbage() throws Exception {
			mvc.perform(post("/api/v1/auth/refresh")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", "garbage"))).andExpect(status().isUnauthorized());
		}

	}

	@Nested
	@DisplayName("로그아웃")
	class Logout {

		@Test
		@DisplayName("204 와 쿠키 삭제, 그 뒤 refresh 는 401")
		void logout() throws Exception {
			String refresh = cookieValue(loginOk(), "refresh_token");

			mvc.perform(post("/api/v1/auth/logout").cookie(new Cookie("refresh_token", refresh)))
				.andExpect(status().isNoContent())
				.andExpect(cookie().maxAge("access_token", 0))
				.andExpect(cookie().maxAge("refresh_token", 0));
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", refresh))).andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("모든 기기 로그아웃은 로그인 상태에서만 (토큰 없으면 401, 500 아님)")
		void logoutAllRequiresLogin() throws Exception {
			mvc.perform(post("/api/v1/auth/logout-all")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		}

		@Test
		@DisplayName("모든 기기 로그아웃: 다른 기기의 refresh 도 죽는다")
		void logoutAll() throws Exception {
			MvcResult deviceA = loginOk();
			MvcResult deviceB = loginOk();

			mvc.perform(post("/api/v1/auth/logout-all").cookie(new Cookie("access_token", cookieValue(deviceA, "access_token"))))
				.andExpect(status().isNoContent());
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", cookieValue(deviceB, "refresh_token"))))
				.andExpect(status().isUnauthorized());
		}

	}

	@Nested
	@DisplayName("내 정보")
	class Me {

		@Test
		@DisplayName("토큰 없으면 401 UNAUTHENTICATED (JSON 본문)")
		void unauthenticated() throws Exception {
			mvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.ok").value(false)).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
			mvc.perform(get("/api/v1/users/me").cookie(new Cookie("access_token", "not-a-jwt"))).andExpect(status().isUnauthorized());
		}

		@Test
		@DisplayName("닉네임·종류·역할만 주고 이름·이메일·휴대폰은 없다")
		void meWithoutPii() throws Exception {
			String access = cookieValue(loginOk(), "access_token");

			String body = mvc.perform(get("/api/v1/users/me").cookie(new Cookie("access_token", access)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.id").value(personal.getId().toString()))
				.andExpect(jsonPath("$.data.kind").value("PERSONAL"))
				.andExpect(jsonPath("$.data.role").value("USER"))
				.andExpect(jsonPath("$.data.nickname").value("테스터"))
				.andExpect(jsonPath("$.data.mustChangePassword").value(false))
				.andReturn().getResponse().getContentAsString();
			assertThat(body).doesNotContain("email").doesNotContain("phone").doesNotContain("\"name\"");
		}

		@Test
		@DisplayName("access 토큰이 살아 있어도 정지되면 401")
		void suspendedAfterLogin() throws Exception {
			String access = cookieValue(loginOk(), "access_token");
			jdbc.update("update users set status = 'suspended' where id = ?", personal.getId());

			mvc.perform(get("/api/v1/users/me").cookie(new Cookie("access_token", access))).andExpect(status().isUnauthorized());
		}

	}

	@Nested
	@DisplayName("관리자 시드")
	class AdminSeed {

		@Test
		@DisplayName("앱 시작 시 admin 1명이 must_change_password=true 로 생긴다")
		void seeded() {
			assertThat(users.existsByRoleAndDeletedAtIsNull(UserRole.ADMIN)).isTrue();
			User admin = users.findByLoginIdAndDeletedAtIsNull("admin").orElseThrow();
			assertThat(admin.getRole()).isEqualTo(UserRole.ADMIN);
			assertThat(admin.isMustChangePassword()).isTrue();
			assertThat(admin.getPasswordHash()).startsWith("$2a$12$");
		}

		@Test
		@DisplayName("시드 관리자로 로그인하면 /me 가 비밀번호 변경 필요를 알린다")
		void adminLogin() throws Exception {
			MvcResult r = mvc.perform(loginRequest("admin", "admin-test-password!1", true)).andExpect(status().isOk()).andReturn();

			mvc.perform(get("/api/v1/users/me").cookie(new Cookie("access_token", cookieValue(r, "access_token"))))
				.andExpect(jsonPath("$.data.role").value("ADMIN"))
				.andExpect(jsonPath("$.data.mustChangePassword").value(true));
		}

	}

	@Nested
	@DisplayName("보안 이벤트 로그")
	class SecurityLogs {

		@Test
		@DisplayName("로그인 실패·잠금은 IP 와 userId 만 남기고 아이디·이메일은 남기지 않는다")
		void failureAndLockLogged(CapturedOutput output) throws Exception {
			for (int i = 0; i < 5; i++) {
				mvc.perform(loginRequest("tester1", "wrong-wrong-1!", true).with(r -> { r.setRemoteAddr("10.1.2.3"); return r; }));
			}

			assertThat(output).contains("로그인 실패 userId=" + personal.getId() + " ip=10.1.2.3").contains("로그인 잠금");
			assertThat(output.getOut()).doesNotContain("tester1").doesNotContain("tester1@example.com");
		}

		@Test
		@DisplayName("refresh 재사용 감지는 WARN 으로 userId 를 남긴다")
		void reuseDetectionLogged(CapturedOutput output) throws Exception {
			String first = cookieValue(loginOk(), "refresh_token");
			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", first)));
			redis.delete(redis.keys("session:*:prev"));

			mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", first))).andExpect(status().isUnauthorized());
			assertThat(output).contains("WARN").contains("refresh 토큰 재사용 감지").contains("userId=" + personal.getId());
		}

		@Test
		@DisplayName("인증된 요청의 로그에는 requestId 와 userId 가 붙는다")
		void mdcInLogLine(CapturedOutput output) throws Exception {
			String access = cookieValue(loginOk(), "access_token");
			jdbc.update("update users set status = 'suspended' where id = ?", personal.getId());

			// /me 가 401 을 내면서 아무 로그도 안 남기므로, 로그가 확실히 찍히는 정지 로그인 시도로 패턴을 확인
			mvc.perform(loginRequest("tester1", PASSWORD, true));
			assertThat(output.getOut()).containsPattern("\\[[0-9a-f-]{36},\\] .*정지 계정 로그인 시도 userId=" + personal.getId());
			assertThat(access).isNotBlank();
		}

	}

	@Test
	@DisplayName("모르는 경로: 로그인 전엔 401(경로 존재를 안 알려줌), 로그인 후엔 404 JSON")
	void unknownPath() throws Exception {
		mvc.perform(get("/api/v1/nothing")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/nothing").cookie(new Cookie("access_token", cookieValue(loginOk(), "access_token"))))
			.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	@DisplayName("잘못된 메서드·본문도 500 이 아니라 우리 형식의 405·400")
	void mvcErrorsAreJson() throws Exception {
		mvc.perform(get("/api/v1/auth/login")).andExpect(status().isMethodNotAllowed())
			.andExpect(jsonPath("$.ok").value(false)).andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{not json"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
	}


}
