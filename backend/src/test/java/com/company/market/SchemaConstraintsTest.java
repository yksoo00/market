package com.company.market;

import java.time.LocalDate;
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

/**
 * 문서(data-model.md)에 적힌 규칙 중 DB 가 직접 막아야 하는 것들이 실제로 막히는지.
 * 엔티티를 거치지 않고 SQL 로 넣는다 — 앱 코드가 아니라 스키마를 검증하는 테스트라서.
 * @Transactional 을 안 쓰는 이유: Postgres 는 한 트랜잭션에서 오류가 나면 이후 문장을 전부 거부해서(25P02)
 * 위반 여러 개를 한 테스트에서 확인할 수 없다. 문장마다 자동 커밋하고 끝에 지운다.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class SchemaConstraintsTest {

	@Autowired
	JdbcTemplate jdbc;

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from organization_members");
		jdbc.update("delete from social_accounts");
		jdbc.update("delete from organizations");
		jdbc.update("delete from users");
	}

	private void insertUser(String email, String status, String deletedAt) {
		jdbc.update("""
				insert into users (kind, status, nickname, email, created_at, updated_at, deleted_at)
				values ('business', ?, ?, ?, now(), now(), %s)
				""".formatted(deletedAt), status, "n-" + UUID.randomUUID(), email);
	}

	@Test
	@DisplayName("withdrawn 이면 deleted_at 이 있어야 하고, deleted_at 이 있으면 withdrawn 이어야 한다")
	void withdrawnAndDeletedAtMoveTogether() {
		assertThatThrownBy(() -> insertUser("a@x.com", "withdrawn", "null")).isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertUser("b@x.com", "active", "now()")).isInstanceOf(DataIntegrityViolationException.class);
		assertThatCode(() -> insertUser("c@x.com", "withdrawn", "now()")).doesNotThrowAnyException();
	}

	@Test
	@DisplayName("대소문자만 다른 이메일은 중복이다")
	void emailUniqueIgnoresCase() {
		insertUser("Same@Example.com", "active", "null");

		assertThatThrownBy(() -> insertUser("same@example.com", "active", "null")).isInstanceOf(DataIntegrityViolationException.class);
	}

	private UUID insertUserReturningId() {
		insertUser(UUID.randomUUID() + "@x.com", "active", "null");
		return jdbc.queryForObject("select id from users order by created_at desc limit 1", UUID.class);
	}

	@Test
	@DisplayName("한 계정에 소셜 연결은 하나만")
	void oneSocialAccountPerUser() {
		UUID userId = insertUserReturningId();
		String sql = "insert into social_accounts (user_id, provider, provider_user_id, connected_at, created_at, updated_at) values (?, ?, ?, now(), now(), now())";
		jdbc.update(sql, userId, "kakao", "k-1");

		assertThatThrownBy(() -> jdbc.update(sql, userId, "naver", "n-1")).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("한 사람은 한 조직의 담당자만 될 수 있다")
	void oneOrganizationPerUser() {
		UUID userId = insertUserReturningId();
		insertOrganization("pending", "null", null);
		insertOrganization("pending", "null", null);
		var orgIds = jdbc.queryForList("select id from organizations order by created_at", UUID.class);
		String sql = "insert into organization_members (organization_id, user_id, created_at, updated_at) values (?, ?, now(), now())";
		jdbc.update(sql, orgIds.get(0), userId);

		assertThatThrownBy(() -> jdbc.update(sql, orgIds.get(1), userId)).isInstanceOf(DataIntegrityViolationException.class);
	}

	private void insertOrganization(String reviewStatus, String reviewedAt, String rejectReason) {
		jdbc.update("""
				insert into organizations (biz_no, name, owner_name, start_date, biz_type, address, review_status, reviewed_at, reject_reason, created_at, updated_at)
				values (?, '상호', '대표', ?, 'corporation', '주소', ?, %s, ?, now(), now())
				""".formatted(reviewedAt), String.format("%010d", Math.abs(UUID.randomUUID().getLeastSignificantBits() % 10_000_000_000L)), LocalDate.of(2020, 1, 1), reviewStatus, rejectReason);
	}

	@Test
	@DisplayName("심사 시각 없이 approved/rejected 가 될 수 없고, rejected 는 사유가 있어야 한다")
	void reviewResultNeedsTimestampAndReason() {
		assertThatThrownBy(() -> insertOrganization("approved", "null", null)).isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertOrganization("rejected", "now()", null)).isInstanceOf(DataIntegrityViolationException.class);
		assertThatCode(() -> insertOrganization("pending", "null", null)).doesNotThrowAnyException();
		assertThatCode(() -> insertOrganization("approved", "now()", null)).doesNotThrowAnyException();
		assertThatCode(() -> insertOrganization("rejected", "now()", "서류 불일치")).doesNotThrowAnyException();
	}

}
