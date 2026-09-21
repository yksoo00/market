package com.company.market;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class MarketApplicationTests {

	@Test
	void contextLoads() {
	}

}
