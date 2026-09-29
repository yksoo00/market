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
		jdbc.update("delete from users where role <> 'admin'");
	}

	private void insertUser(String userId, String email, String userClass, String busRegId, String status, String deletedAt) {
		jdbc.update("""
				insert into users (user_id, password, user_class, user_name, user_email, bus_reg_id, company_type,
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
				insert into users (user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('biz001', 'hashed', 'business', '담당자', '20260928120000', '20260928120000')
				""")).isInstanceOf(DataIntegrityViolationException.class);

		insertUser("biz002", "biz1@example.com", "business", "1234567890", "active", "null");
		assertThatThrownBy(() -> insertUser("biz003", "biz2@example.com", "business", "1234567890", "active", "null"))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

}
