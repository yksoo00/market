package com.company.market;

import java.util.Map;

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
 * 상품마스터 정의서 마이그레이션(V202610281000~1010)이 기존 상품마스터 값을 새 칸으로 옮기고 카테고리 마스터를 채우는지.
 * 앱 스키마와 섞이지 않게 별도 스키마(prodtest)에 그 직전 버전까지 올리고 데이터를 넣은 뒤 나머지를 적용한다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ProductMasterMigrationTest {

	private static final String SCHEMA = "prodtest";

	@Autowired
	DataSource dataSource;

	JdbcTemplate jdbc;

	@BeforeAll
	void migrateWithOldData() {
		jdbc = new JdbcTemplate(dataSource);
		flyway("202610271040").migrate();
		jdbc.update("""
				insert into prodtest.trd_prod_master (prod_id, category_code, prod_name, prod_mpn, prod_brand, prod_photo_1,
					prod_scan_code, reg_date)
				values ('MIGPM001', 'P01-Q01-R001', '상품', 'MPN-1', '브랜드', 'listing/photo/a.jpg', 'SC1', '20261015100000')
				""");
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
	@DisplayName("카테고리 경로 코드는 대·중·소 조각 세 칸으로 나뉜다")
	void categoryCodeSplitIntoFragments() {
		var row = jdbc.queryForMap("""
				select major_category, middle_category, minor_category from prodtest.trd_prod_master where prod_id = 'MIGPM001'
				""");
		assertThat(row).isEqualTo(Map.of("major_category", "P01", "middle_category", "Q01", "minor_category", "R001"));
	}

	@Test
	@DisplayName("이름이 바뀐 칸(prod_mpn→prod_part_no, prod_photo_1→prod_image)은 값을 유지한다")
	void renamedColumnsKeepValues() {
		var row = jdbc.queryForMap("select prod_part_no, prod_image from prodtest.trd_prod_master where prod_id = 'MIGPM001'");
		assertThat(row).isEqualTo(Map.of("prod_part_no", "MPN-1", "prod_image", "listing/photo/a.jpg"));
	}

	@Test
	@DisplayName("카테고리 마스터는 trd_ctgr_code 239행을 조각 코드로 옮긴다 — 분류레벨은 대/중/소, 부모는 부모 조각")
	void ctgrMasterSeededFromCtgrCode() {
		assertThat(jdbc.queryForObject("select count(*) from prodtest.trd_ctgr_master", Integer.class)).isEqualTo(239);
		var minor = jdbc.queryForMap("""
				select category_name, category_depth, parent_code from prodtest.trd_ctgr_master where category_code = 'R001'
				""");
		assertThat(minor).isEqualTo(Map.of("category_name", "인텔 CPU", "category_depth", "소", "parent_code", "Q01"));
		var middle = jdbc.queryForMap(
				"select category_depth, parent_code from prodtest.trd_ctgr_master where category_code = 'Q01'");
		assertThat(middle).isEqualTo(Map.of("category_depth", "중", "parent_code", "P01"));
		var major = jdbc.queryForMap(
				"select category_depth, parent_code from prodtest.trd_ctgr_master where category_code = 'P01'");
		assertThat(major.get("category_depth")).isEqualTo("대");
		assertThat(major.get("parent_code")).isNull();
		assertThat(jdbc.queryForObject("""
				select count(*) from prodtest.trd_ctgr_master m
				  join prodtest.trd_ctgr_code c on substring(c.category_code from '[^-]+$') = m.category_code
				 where m.is_display = c.is_display and m.reg_date = c.reg_date
				""", Integer.class)).isEqualTo(239);
	}

}
