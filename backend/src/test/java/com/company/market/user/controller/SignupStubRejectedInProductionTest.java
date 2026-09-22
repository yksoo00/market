package com.company.market.user.controller;

import com.company.market.TestInfraConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 운영 설정(provider=pass)이면 stub 토큰으로 가입할 수 없어야 한다. 이게 깨지면 누구나 본인인증 없이 가입하는 구멍.
 * 프로퍼티가 달라 별도 컨텍스트가 뜬다 — 그래서 테스트 하나만.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest(properties = "app.identity-verification.provider=pass")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SignupStubRejectedInProductionTest {

	@Autowired
	MockMvc mvc;

	@Test
	@DisplayName("provider=pass 면 stub 토큰은 VERIFICATION_EXPIRED")
	void stubTokenRejected() throws Exception {
		mvc.perform(post("/api/v1/auth/signup/personal").contentType(MediaType.APPLICATION_JSON).content(SignupApiTest.body(java.util.Map.of())))
			.andExpect(status().isGone()).andExpect(jsonPath("$.code").value("VERIFICATION_EXPIRED"));
	}

}
