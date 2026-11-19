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
 * 제조일 컬럼 삭제(V202611050900)가 이미 행이 들어 있는 테이블에서도 되는지 — 삭제 직전 버전까지 올려 제조일이 든 행을 넣고 나머지를 적용한다.
 * 앱 스키마와 섞이지 않게 별도 스키마(dropmufctest)를 쓴다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DropMufcDateMigrationTest {

	private static final String SCHEMA = "dropmufctest";

	@Autowired
	DataSource dataSource;

	JdbcTemplate jdbc;

	@BeforeAll
	void migrateWithPopulatedColumns() {
		jdbc = new JdbcTemplate(dataSource);
		flyway("202611021000").migrate();
		jdbc.update("""
				insert into dropmufctest.trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name,
					prod_brand, prod_mufc_date, reg_date)
				values ('DROPMUFC01', 'P01', 'Q01', 'R001', '상품', '브랜드', '20260101', '20261015100000')
				""");
		jdbc.update("""
				insert into dropmufctest.trd_cart_info (user_id, trade_id, ser_no, cart_type, prod_date, prod_name, prod_no, mufc_date,
					prod_spec_info, prod_state, prov_date, order_unit_price, order_quantity, req_deli_date, reg_date)
				values (?, '26110500001', 1, '장바구니', '20261015100000', '상품', 'DROPMUFC01', '20260101',
					'', '신품', '2026-11-10', 1000, 1, '2026-11-12', '20261105090000')
				""", UUID.randomUUID());
		flyway(null).migrate();
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
		jdbc.execute("drop schema " + SCHEMA + " cascade");
	}

	@Test
	@DisplayName("제조일이 든 행이 있어도 두 컬럼이 지워지고, 행과 나머지 값은 그대로다")
	void dropsColumnsAndKeepsRows() {
		assertThat(jdbc.queryForList("""
				select table_name || '.' || column_name from information_schema.columns
				 where table_schema = 'dropmufctest' and column_name in ('prod_mufc_date', 'mufc_date')
				""", String.class)).isEmpty();
		assertThat(jdbc.queryForObject("select prod_name from dropmufctest.trd_prod_master where prod_id = 'DROPMUFC01'", String.class))
			.isEqualTo("상품");
		assertThat(jdbc.queryForObject("select prod_name from dropmufctest.trd_cart_info where trade_id = '26110500001'", String.class))
			.isEqualTo("상품");
	}

}
