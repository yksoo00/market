package com.company.market;

import java.util.List;
import java.util.Map;
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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 장바구니 정보 마이그레이션(V202610291000)이 기존 장바구니 거래 행을 trd_cart_info 로 옮기는지.
 * 앱 스키마와 섞이지 않게 별도 스키마(carttest)에 직전 버전까지 올리고 데이터를 넣은 뒤 나머지를 적용한다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CartInfoMigrationTest {

	private static final String SCHEMA = "carttest";

	@Autowired
	DataSource dataSource;

	JdbcTemplate jdbc;

	UUID seller;

	UUID buyer;

	@BeforeAll
	void migrateWithOldData() {
		jdbc = new JdbcTemplate(dataSource);
		flyway("202610281010").migrate();
		jdbc.update("""
				insert into carttest.trd_user_info (user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('cseller', 'hashed', 'personal', '판매자', '20261015100000', '20261015100000'),
				       ('cbuyer', 'hashed', 'personal', '구매자', '20261015100000', '20261015100000')
				""");
		seller = jdbc.queryForObject("select uid from carttest.trd_user_info where user_id = 'cseller'", UUID.class);
		buyer = jdbc.queryForObject("select uid from carttest.trd_user_info where user_id = 'cbuyer'", UUID.class);
		jdbc.update("""
				insert into carttest.trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name,
					prod_part_no, prod_brand, prod_mufc_date, prod_spec_info, reg_date)
				values ('CARTMIG01', 'P01', 'Q01', 'R001', '상품', 'MPN-1', '브랜드', '20260101', '16GB', '20261015100000'),
				       ('CARTMIG02', 'P01', 'Q01', 'R001', '상품2', null, null, null, null, '20261015100000')
				""");
		for (String[] listing : new String[][] { { "20261015100000", "CARTMIG01" }, { "20261015100001", "CARTMIG02" } }) {
			jdbc.update("""
					insert into carttest.trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price,
						sales_quantity, prov_date)
					values (?, ?, ?, '등록', '신품', 1000, 10, '2026-10-20')
					""", seller, listing[0], listing[1]);
		}
		insertTrade("26102910001", "구매검토", "장바구니", "20261015100000", "CARTMIG01", 3);
		insertTrade("26102910002", "구매검토", "장바구니", "20261015100001", "CARTMIG02", 1);
		insertTrade("26102910003", "견적조정", "견적요청", "20261015100000", "CARTMIG01", 2);
		flyway(null).migrate();
	}

	private void insertTrade(String tradeId, String type, String stats, String prodRegDate, String prodId, int quantity) {
		jdbc.update("""
				insert into carttest.trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, reg_date, prod_id,
					prod_state, sales_unit_price, stock_quantity, min_order_quantity, order_unit, prov_date, order_unit_price,
					order_quantity, req_deli_date, remarks, trade_stats)
				values (?, ?, ?, ?, ?, '20261016090000', ?, '신품', 1000, 10, 1, 1, '2026-10-20', 1000, ?, '2026-10-25', '메모', ?)
				""", buyer, tradeId, type, seller, prodRegDate, prodId, quantity, stats);
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
	@DisplayName("기존 장바구니 거래 행은 trd_cart_info 로 — 같은 거래ID, ser_no 는 거래ID 순, 상품 값은 상품마스터, 빈 사양은 ''")
	void existingCartRowsMigrated() {
		List<Map<String, Object>> rows = jdbc.queryForList("select * from carttest.trd_cart_info order by ser_no");
		assertThat(rows).hasSize(2);
		Map<String, Object> first = rows.get(0);
		assertThat(first).containsEntry("user_id", buyer).containsEntry("trade_id", "26102910001").containsEntry("ser_no", 1)
			.containsEntry("cart_type", "장바구니").containsEntry("seller_id", seller)
			.containsEntry("prod_date", "20261015100000").containsEntry("prod_no", "CARTMIG01")
			.containsEntry("prod_name", "상품").containsEntry("manufacturer", "브랜드").containsEntry("mufc_date", "20260101")
			.containsEntry("prod_spec_info", "16GB").containsEntry("prod_state", "신품").containsEntry("prov_date", "2026-10-20")
			.containsEntry("order_unit_price", 1000).containsEntry("order_quantity", 3)
			.containsEntry("req_deli_date", "2026-10-25").containsEntry("remarks", "메모")
			.containsEntry("reg_date", "20261016090000");
		Map<String, Object> second = rows.get(1);
		assertThat(second).containsEntry("trade_id", "26102910002").containsEntry("ser_no", 2)
			.containsEntry("prod_spec_info", "");
		assertThat(second.get("manufacturer")).isNull();
	}

	@Test
	@DisplayName("견적 행은 trd_cart_info 로 옮기지 않는다")
	void quoteRowsNotMigrated() {
		assertThat(jdbc.queryForObject("select count(*) from carttest.trd_cart_info where trade_id = '26102910003'",
				Integer.class)).isZero();
	}

	@Test
	@DisplayName("같은 매물의 비교용 행은 1행만(둘째 거부), 장바구니 행은 여러 줄 가능 (V202611021000)")
	void compareRowsAreUniqueButCartRowsRepeat() {
		insertTrade("26102910004", "구매검토", "비교용", "20261015100000", "CARTMIG01", 1);
		assertThatThrownBy(() -> insertTrade("26102910005", "구매검토", "비교용", "20261015100000", "CARTMIG01", 1))
			.isInstanceOf(DuplicateKeyException.class);
		insertTrade("26102910006", "구매검토", "장바구니", "20261015100000", "CARTMIG01", 1);
		insertTrade("26102910007", "구매검토", "장바구니", "20261015100000", "CARTMIG01", 1);
	}

}
