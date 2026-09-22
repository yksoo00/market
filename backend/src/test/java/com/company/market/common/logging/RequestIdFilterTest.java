package com.company.market.common.logging;

import com.company.market.TestInfraConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RequestIdFilterTest {

	@Autowired
	MockMvc mvc;

	@Test
	@DisplayName("요청에 X-Request-Id 가 없으면 만들어 응답 헤더로 돌려준다 (401 응답에도)")
	void generatesWhenMissing() throws Exception {
		String id = mvc.perform(get("/api/v1/users/me")).andReturn().getResponse().getHeader(RequestIdFilter.HEADER);

		assertThat(id).matches("[0-9a-f-]{36}");
	}

	@Test
	@DisplayName("프록시가 준 X-Request-Id 는 그대로 쓴다")
	void echoesIncoming() throws Exception {
		mvc.perform(get("/actuator/health").header(RequestIdFilter.HEADER, "caddy-abc123.def"))
			.andExpect(header().string(RequestIdFilter.HEADER, "caddy-abc123.def"));
	}

	@Test
	@DisplayName("형식이 이상한 X-Request-Id(짧거나 특수문자)는 버리고 새로 만든다")
	void replacesInvalid() throws Exception {
		String id = mvc.perform(get("/actuator/health").header(RequestIdFilter.HEADER, "bad id\nwith newline"))
			.andReturn().getResponse().getHeader(RequestIdFilter.HEADER);

		assertThat(id).matches("[0-9a-f-]{36}");
	}

}
