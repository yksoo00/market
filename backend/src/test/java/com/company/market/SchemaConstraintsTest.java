package com.company.market;

import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 단일 users 테이블의 핵심 제약을 DB에서 확인한다. */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class SchemaConstraintsTest {

	@Autowired
	JdbcTemplate jdbc;

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_user_info where role <> 'admin'");
	}

	private void insertUser(String userId, String email, String userClass, String busRegId, String status, String deletedAt) {
		jdbc.update("""
				insert into trd_user_info (user_id, password, user_class, user_name, user_email, bus_reg_id, company_type,
					company_name, company_open_date, dt_reg, dt_update, status, deleted_at)
				values (?, 'hashed', ?, '사용자', ?, ?, case when ? = 'business' then 'corporate' else null end,
					case when ? = 'business' then '회사' else null end,
					case when ? = 'business' then '20200101' else null end,
					'20260928120000', '20260928120000', ?, %s)
				""".formatted(deletedAt), userId, userClass, email, busRegId, userClass, userClass, userClass, status);
	}

	@Test
	@DisplayName("withdrawn 상태와 deleted_at 은 함께 설정되어야 한다")
	void withdrawnAndDeletedAtMoveTogether() {
		assertThatThrownBy(() -> insertUser("user001", "a@x.com", "personal", null, "withdrawn", "null"))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertUser("user002", "b@x.com", "personal", null, "active", "now()"))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatCode(() -> insertUser("user003", "c@x.com", "personal", null, "withdrawn", "now()"))
			.doesNotThrowAnyException();
	}

	@Test
	@DisplayName("활성 사용자 ID와 이메일은 중복될 수 없다")
	void activeIdsAndEmailsAreUnique() {
		insertUser("user004", "Same@Example.com", "personal", null, "active", "null");
		assertThatThrownBy(() -> insertUser("user004", "other@x.com", "personal", null, "active", "null"))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertUser("user005", "same@example.com", "personal", null, "active", "null"))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("기업 계정은 회사 식별 필드가 필요하고 사업자번호는 중복될 수 없다")
	void businessAccountNeedsCompanyFieldsAndUniqueNumber() {
		assertThatThrownBy(() -> jdbc.update("""
				insert into trd_user_info (user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('biz001', 'hashed', 'business', '담당자', '20260928120000', '20260928120000')
				""")).isInstanceOf(DataIntegrityViolationException.class);

		insertUser("biz002", "biz1@example.com", "business", "1234567890", "active", "null");
		assertThatThrownBy(() -> insertUser("biz003", "biz2@example.com", "business", "1234567890", "active", "null"))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("정의서 물리명: trd_prod_master·trd_prod_reg·trd_user_info, prod_mpn·prod_scan_code·prov_date·prod_coa·uid 컬럼이 있다")
	void legacyPhysicalNames() {
		String[][] columns = { { "trd_prod_master", "prod_mpn" }, { "trd_prod_master", "prod_scan_code" },
				{ "trd_prod_reg", "prov_date" }, { "trd_prod_reg", "prod_coa" }, { "trd_user_info", "uid" } };
		for (String[] c : columns) {
			assertThat(jdbc.queryForObject("select count(*) from information_schema.columns "
					+ "where table_schema = current_schema() and table_name = ? and column_name = ?",
					Integer.class, c[0], c[1])).as(c[0] + "." + c[1]).isEqualTo(1);
		}
		assertThat(jdbc.queryForObject("select count(*) from information_schema.tables "
				+ "where table_schema = current_schema() and table_name in ('products', 'listings', 'users')",
				Integer.class)).isZero();
	}

}
