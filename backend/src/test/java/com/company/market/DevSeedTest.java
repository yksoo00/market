package com.company.market;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 로컬 .env 의 FLYWAY_LOCATIONS(db/seed 포함)로 빈 DB 를 만들면 샘플 데이터가 들어가는지.
 * 속성이 달라 다른 테스트와 컨텍스트(=Testcontainers DB)를 같이 쓰지 않는다 — 샘플이 다른 테스트 DB 에 섞이지 않는다.
 * 스키마가 바뀌어 시드 SQL 이 깨지면 여기서 먼저 실패한다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest(properties = "spring.flyway.locations=classpath:db/migration,classpath:db/seed")
@ActiveProfiles("test")
class DevSeedTest {

	@Autowired
	JdbcTemplate jdbc;

	@Test
	@DisplayName("시드 포함으로 새 DB 를 만들면 카테고리 239건·상품마스터 샘플 50건이 들어간다")
	void freshDatabaseGetsSeed() {
		assertThat(jdbc.queryForObject("select count(*) from trd_ctgr_code", Integer.class)).isEqualTo(239);
		assertThat(jdbc.queryForObject("select count(*) from trd_prod_master where prod_id like 'KP-2026-0000%'", Integer.class))
			.isEqualTo(50);
	}

}
