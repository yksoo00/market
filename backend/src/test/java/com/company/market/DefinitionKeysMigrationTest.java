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
 * 정의서 복합키 마이그레이션(V202610271000~1030)이 기존 개발 데이터를 새 NOT NULL·이름에 맞게 옮기는지.
 * 앱 스키마와 섞이지 않게 별도 스키마(migtest)에 그 직전 버전까지 올리고 데이터를 넣은 뒤 나머지를 적용한다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DefinitionKeysMigrationTest {

	private static final String SCHEMA = "migtest";

	@Autowired
	DataSource dataSource;

	JdbcTemplate jdbc;

	UUID seller;

	UUID buyer;

	@BeforeAll
	void migrateWithOldData() {
		jdbc = new JdbcTemplate(dataSource);
		flyway("202610211300").migrate();
		jdbc.update("""
				insert into migtest.trd_user_info (user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('mseller', 'hashed', 'personal', '판매자', '20261015100000', '20261015100000'),
				       ('mbuyer', 'hashed', 'personal', '구매자', '20261015100000', '20261015100000')
				""");
		seller = jdbc.queryForObject("select uid from migtest.trd_user_info where user_id = 'mseller'", UUID.class);
		buyer = jdbc.queryForObject("select uid from migtest.trd_user_info where user_id = 'mbuyer'", UUID.class);
		jdbc.update("""
				insert into migtest.trd_prod_master (prod_id, category_code, prod_name, prod_brand, reg_date)
				values ('MIGTEST001', 'P01-Q01-R001', '상품', '브랜드', '20261015100000')
				""");
		// 제공가능일 없는 매물 (옛 규칙에선 선택)
		jdbc.update("""
				insert into migtest.trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price, sales_quantity)
				values (?, '20261015100000', 'MIGTEST001', '판매', '신품', 1000, 10)
				""", seller);
		// 납품희망일 없는 견적 행 (옛 규칙에선 견적은 납품희망일을 받지 않음)
		jdbc.update("""
				insert into migtest.trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, trade_stats)
				values (?, '26101510001', '견적조정', ?, '20261015100000', 'MIGTEST001', 900, 1, '견적요청')
				""", buyer, seller);
		// 요청 뒤 판매자가 상품을 바꿔 거래의 prod_id(옛 스냅샷)가 매물과 다른 행 — 세 값으로 찾으려면 맞춰야 한다
		jdbc.update("""
				insert into migtest.trd_prod_master (prod_id, category_code, prod_name, prod_brand, reg_date)
				values ('MIGTEST000', 'P01-Q01-R001', '옛 상품', '브랜드', '20261015100000')
				""");
		jdbc.update("""
				insert into migtest.trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, req_deli_date, trade_stats)
				values (?, '26101510002', '거래', ?, '20261015100000', 'MIGTEST000', 1000, 1, '2099-12-31', '구매요청')
				""", buyer, seller);
		jdbc.update("""
				insert into migtest.trd_trade_history (trade_id, trade_date, prod_id, trade_type, seller_id, buyer_id)
				values ('26101510001', '20261016100000', 'MIGTEST001', '거래', ?, ?)
				""", seller, buyer);
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
	@DisplayName("제공가능일 없는 매물은 등록일(reg_date 앞 8자리)로 채운다")
	void listingProvDateBackfilled() {
		assertThat(jdbc.queryForObject("select prov_date from migtest.trd_prod_reg where user_id = ?", String.class, seller))
			.isEqualTo("2026-10-15");
	}

	@Test
	@DisplayName("거래 행: prov_date·req_deli_date 는 매물 제공가능일로, 거래 reg_date 는 거래ID 앞 8자리로, 매물 등록일시는 prod_reg_date")
	void tradeInfoBackfilled() {
		var row = jdbc.queryForMap("""
				select prod_reg_date, reg_date, prov_date, req_deli_date from migtest.trd_trade_info where trade_id = '26101510001'
				""");
		assertThat(row.get("prod_reg_date")).isEqualTo("20261015100000");
		assertThat(row.get("reg_date")).isEqualTo("20261015100000");
		assertThat(row.get("prov_date")).isEqualTo("2026-10-15");
		assertThat(row.get("req_deli_date")).isEqualTo("2026-10-15");
	}

	@Test
	@DisplayName("거래 prod_id 가 매물과 다르면(요청 뒤 상품 변경) 매물의 prod_id 로 맞춘다")
	void tradeProdIdRealigned() {
		assertThat(jdbc.queryForObject("select prod_id from migtest.trd_trade_info where trade_id = '26101510002'", String.class))
			.isEqualTo("MIGTEST001");
	}

	@Test
	@DisplayName("거래이력의 buyer_id 는 user_id 로 옮겨진다")
	void historyBuyerRenamed() {
		assertThat(jdbc.queryForObject("select user_id from migtest.trd_trade_history where trade_id = '26101510001'",
				UUID.class)).isEqualTo(buyer);
	}

}
