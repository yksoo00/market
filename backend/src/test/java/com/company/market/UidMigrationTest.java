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
 * uid uuid → varchar(11) 마이그레이션(V202611201100, decisions.md 2026-11-20). 별도 스키마(uidtest)에 직전 버전까지 올리고
 * 사용자·매물을 넣은 뒤 나머지를 적용한다: 가입일(dt_reg) 기준 날짜별 001~ 로 새 uid 를 주고, uid 를 담은 다른 테이블 값도 같이 바뀐다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class UidMigrationTest {

	private static final String SCHEMA = "uidtest";

	@Autowired
	DataSource dataSource;

	JdbcTemplate jdbc;

	UUID orphan = UUID.randomUUID();

	@BeforeAll
	void migrateWithOldData() {
		jdbc = new JdbcTemplate(dataSource);
		flyway("202611201000").migrate();
		// 같은 날 둘(dt_reg 순), 다른 날 하나
		jdbc.update("""
				insert into uidtest.trd_user_info (user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('uidb', 'h', 'personal', 'B', '20261015110000', '20261015110000'),
				       ('uida', 'h', 'personal', 'A', '20261015100000', '20261015100000'),
				       ('uidc', 'h', 'personal', 'C', '20261016090000', '20261016090000')
				""");
		jdbc.update("""
				insert into uidtest.trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name,
					prod_part_no, prod_brand, prod_spec_info, reg_date)
				values ('UIDMIG01', 'P01', 'Q01', 'R001', '상품', 'MPN-1', '브랜드', '16GB', '20261015100000')
				""");
		jdbc.update("""
				insert into uidtest.trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price, sales_quantity, prov_date)
				select uid, '20261015100000', 'UIDMIG01', '등록', '신품', 1000, 10, '20261020' from uidtest.trd_user_info where user_id = 'uidb'
				""");
		// 사용자 행이 없는 옛 uuid(고아 값)
		jdbc.update("""
				insert into uidtest.trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price, sales_quantity, prov_date)
				values (?, '20261015100001', 'UIDMIG01', '등록', '신품', 1000, 10, '20261020')
				""", orphan);
		flyway(null).migrate();
	}

	@Test
	@DisplayName("가입일 기준 날짜별 001~ (같은 날은 dt_reg 순)")
	void usersGetDailySequence() {
		assertThat(uidOf("uida")).isEqualTo("UP261015001");
		assertThat(uidOf("uidb")).isEqualTo("UP261015002");
		assertThat(uidOf("uidc")).isEqualTo("UP261016001");
	}

	@Test
	@DisplayName("uid 를 담은 다른 테이블 값도 새 uid 로 같이 바뀐다")
	void referencesFollow() {
		assertThat(jdbc.queryForObject("select user_id from uidtest.trd_prod_reg where reg_date = '20261015100000'", String.class))
			.isEqualTo("UP261015002");
	}

	@Test
	@DisplayName("사용자 행이 없는 옛 uuid 는 하이픈 뺀 앞 11자리로 두어 마이그레이션이 멈추지 않는다")
	void orphanKeepsPrefix() {
		assertThat(jdbc.queryForObject("select user_id from uidtest.trd_prod_reg where reg_date = '20261015100001'", String.class))
			.isEqualTo(orphan.toString().replace("-", "").substring(0, 11));
	}

	@Test
	@DisplayName("uid 컬럼은 varchar(11) 이고 DB 기본값이 없다")
	void columnShape() {
		assertThat(jdbc.queryForObject("""
				select data_type || ':' || character_maximum_length || ':' || coalesce(column_default, '-')
				  from information_schema.columns where table_schema = 'uidtest' and table_name = 'trd_user_info' and column_name = 'uid'
				""", String.class)).isEqualTo("character varying:11:-");
	}

	private String uidOf(String loginId) {
		return jdbc.queryForObject("select uid from uidtest.trd_user_info where user_id = ?", String.class, loginId);
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
