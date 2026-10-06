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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** APP_URL 이 IP 주소여도(사설망 VM) 쿠키에 Domain=<루트 도메인> 을 붙이지 않는다 — 브라우저가 IP 와 안 맞는 Domain 을 거부해 로그인이 안 남는다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest(properties = { "app.app-url=http://10.0.0.5:4321", "app.domain-root=example.com", "app.cookie-secure=false" })
@AutoConfigureMockMvc
@ActiveProfiles("test")
class IpAppUrlCookieApiTest {

	static final String PASSWORD = "Correct-horse-1!";

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
		users.save(User.builder().kind(UserKind.PERSONAL).loginId("iptester").passwordHash(passwordEncoder.encode(PASSWORD))
			.nickname("아이피").nicknameUsage("Y").name("홍길동").email("iptester@example.com").build());
	}

	@AfterEach
	void tearDown() {
		jdbc.update("delete from users where role <> 'admin'");
		Objects.requireNonNull(redis.getConnectionFactory()).getConnection().serverCommands().flushDb();
	}

	@Test
	@DisplayName("APP_URL 이 IP 주소면 쿠키에 Domain 을 붙이지 않는다")
	void noCookieDomainForIpAppUrl() throws Exception {
		var res = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).header(HttpHeaders.ORIGIN, "http://10.0.0.5:4321")
				.content("""
						{"loginId":"iptester","password":"%s","remember":true}""".formatted(PASSWORD)))
			.andReturn().getResponse();
		assertThat(res.getStatus()).isEqualTo(200);
		assertThat(res.getHeaders(HttpHeaders.SET_COOKIE)).isNotEmpty().allSatisfy(c -> assertThat(c).doesNotContain("Domain="));
	}

}
