package com.company.market.devtools;

import com.company.market.TestInfraConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** APP_ENV 가 local 이 아니면 devtools 빈이 없어 모든 경로가 404 (계획 2026-10-30-dev-table-admin.md) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = { "app.env=prod", "app.identity-verification.provider=pass" })
class DevTableDisabledTest {

	@Autowired
	MockMvc mvc;

	@Test
	@DisplayName("local 이 아니면 404")
	void disabled_outside_local() throws Exception {
		mvc.perform(get("/api/v1/dev/tables")).andExpect(status().isNotFound());
	}

}
