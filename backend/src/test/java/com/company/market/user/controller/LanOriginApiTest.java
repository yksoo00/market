package com.company.market.user.controller;

import java.util.Objects;

import com.company.market.TestInfraConfiguration;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * VM 에 올려 다른 주소(포트포워딩 등)로도, localhost:3000 으로도 쓰는 개발 환경.
 * APP_URL(localhost:3000)에 ALLOWED_ORIGINS 로 다른 출처를 더하고, http 라 Secure 쿠키를 끈다(local 에서만 허용).
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest(properties = { "app.allowed-origins=http://dev-vm.example:4321", "app.cookie-secure=false" })
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LanOriginApiTest {

	static final String PASSWORD = "Correct-horse-1!";

	static final String APP_ORIGIN = "http://localhost:3000";

	static final String LAN_ORIGIN = "http://dev-vm.example:4321";

	@Autowired
	MockMvc mvc;

	@Autowired
	UserRepository users;

	@Autowired
	PasswordEncoder passwordEncoder;

	@Autowired
	StringRedisTemplate redis;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void setUp() {
		users.save(User.builder().kind(UserKind.PERSONAL).loginId("lantester").passwordHash(passwordEncoder.encode(PASSWORD))
			.nickname("랜").nicknameUsage("Y").name("홍길동").email("lantester@example.com").build());
	}

	@AfterEach
	void tearDown() {
		jdbc.update("delete from users where role <> 'admin'");
		Objects.requireNonNull(redis.getConnectionFactory()).getConnection().serverCommands().flushDb();
	}

	private MvcResult login(String origin) throws Exception {
		return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).header(HttpHeaders.ORIGIN, origin)
				.content("""
						{"loginId":"lantester","password":"%s","remember":true}""".formatted(PASSWORD)))
			.andReturn();
	}

	@Test
	@DisplayName("APP_URL 출처와 ALLOWED_ORIGINS 출처의 POST 는 통과, 그 밖의 출처는 403 (CSRF)")
	void bothOriginsPassOthersFail() throws Exception {
		assertThat(login(APP_ORIGIN).getResponse().getStatus()).isEqualTo(200);
		assertThat(login(LAN_ORIGIN).getResponse().getStatus()).isEqualTo(200);
		assertThat(login("http://other-vm.example:4321").getResponse().getStatus()).isEqualTo(403);
		assertThat(login("https://evil.example").getResponse().getStatus()).isEqualTo(403);
	}

	@Test
	@DisplayName("CORS preflight 도 두 출처 모두 허용하고 응답 출처는 요청 출처 그대로 (와일드카드 아님)")
	void corsAllowsBothOrigins() throws Exception {
		for (String origin : new String[] { APP_ORIGIN, LAN_ORIGIN }) {
			mvc.perform(options("/api/v1/auth/login").header(HttpHeaders.ORIGIN, origin)
					.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
		}
		mvc.perform(options("/api/v1/auth/login").header(HttpHeaders.ORIGIN, "http://other-vm.example:4321")
				.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
			.andExpect(status().isForbidden());
	}

	@Test
	@DisplayName("http 로 쓰는 로컬 환경에서는 Secure 가 빠진 쿠키 (HttpOnly·SameSite=Lax 는 그대로)")
	void cookiesWithoutSecureWhenConfigured() throws Exception {
		MvcResult result = login(LAN_ORIGIN);
		var cookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
		assertThat(cookies).isNotEmpty().allSatisfy(c -> {
			assertThat(c).contains("HttpOnly").contains("SameSite=Lax").doesNotContain("Secure");
		});
	}

}
