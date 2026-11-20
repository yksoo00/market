package com.company.market;

import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 제공가능일·납품희망일 숫자만 마이그레이션(V202611201000, decisions.md 2026-11-20). 별도 스키마(datetest)에 직전 버전까지 올리고
 * yyyy-MM-dd 값을 넣은 뒤 나머지를 적용한다. 매물(trd_prod_reg)로 확인한다 — 거래·장바구니 칸은 같은 UPDATE 형태다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DateDigitsMigrationTest {

	private static final String SCHEMA = "datetest";

	@Autowired
	DataSource dataSource;

	JdbcTemplate jdbc;

	@BeforeAll
	void migrateWithOldData() {
		jdbc = new JdbcTemplate(dataSource);
		flyway("202611191000").migrate();
		jdbc.update("""
				insert into datetest.trd_user_info (user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('dseller', 'hashed', 'personal', '판매자', '20261015100000', '20261015100000')
				""");
		UUID seller = jdbc.queryForObject("select uid from datetest.trd_user_info where user_id = 'dseller'", UUID.class);
		jdbc.update("""
				insert into datetest.trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name,
					prod_part_no, prod_brand, prod_spec_info, reg_date)
				values ('DATEMIG01', 'P01', 'Q01', 'R001', '상품', 'MPN-1', '브랜드', '16GB', '20261015100000')
				""");
		// 옛 형식, 이미 숫자만, 형식이 다른 값(그대로 둔다)
		String[][] rows = { { "20261015100000", "2026-10-20" }, { "20261015100001", "20261021" }, { "20261015100002", "내일" } };
		for (String[] r : rows) {
			jdbc.update("""
					insert into datetest.trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price,
						sales_quantity, prov_date)
					values (?, ?, 'DATEMIG01', '등록', '신품', 1000, 10, ?)
					""", seller, r[0], r[1]);
		}
		flyway(null).migrate();
	}

	@Test
	@DisplayName("yyyy-MM-dd 값만 숫자 8자리로 바뀌고, 이미 숫자만이거나 형식이 다른 값은 그대로다")
	void convertsOnlyHyphenDates() {
		assertThat(provDate("20261015100000")).isEqualTo("20261020");
		assertThat(provDate("20261015100001")).isEqualTo("20261021");
		assertThat(provDate("20261015100002")).isEqualTo("내일");
	}

	@Test
	@DisplayName("마이그레이션을 다시 돌려도 값이 그대로다 (멱등)")
	void idempotent() {
		flyway(null).migrate();
		assertThat(provDate("20261015100000")).isEqualTo("20261020");
	}

	private String provDate(String regDate) {
		return jdbc.queryForObject("select prov_date from datetest.trd_prod_reg where reg_date = ?", String.class, regDate);
	}

	private Flyway flyway(String target) {
		var config = Flyway.configure().dataSource(dataSource).schemas(SCHEMA).locations("classpath:db/migration");
		if (target != null) {
			config.target(target);
		}
		return config.load();
	}

	@AfterAll
	void dropSchema() {
		jdbc.execute("drop schema if exists " + SCHEMA + " cascade");
	}

}
