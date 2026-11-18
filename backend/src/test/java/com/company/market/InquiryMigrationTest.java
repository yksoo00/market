package com.company.market;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/** 문의 게시판 테이블(V202611181000) 모양 — 스펙 2026-11-18-inquiry-board-design.md */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class InquiryMigrationTest {

	@Autowired
	JdbcTemplate jdbc;

	private Integer maxLength(String table, String column) {
		return jdbc.queryForObject("select character_maximum_length from information_schema.columns "
				+ "where table_schema = current_schema() and table_name = ? and column_name = ?", Integer.class, table, column);
	}

	private String dataType(String table, String column) {
		return jdbc.queryForObject("select data_type from information_schema.columns "
				+ "where table_schema = current_schema() and table_name = ? and column_name = ?", String.class, table, column);
	}

	@Test
	@DisplayName("문의 테이블 두 개가 있고 컬럼 길이가 정해진 값이다")
	void tablesHaveDefinedColumns() {
		assertThat(maxLength("trd_inquiry", "title")).isEqualTo(100);
		assertThat(maxLength("trd_inquiry", "content")).isEqualTo(2000);
		assertThat(maxLength("trd_inquiry_reply", "content")).isEqualTo(1000);
		assertThat(dataType("trd_inquiry", "created_at")).isEqualTo("timestamp with time zone");
		assertThat(dataType("trd_inquiry_reply", "created_at")).isEqualTo("timestamp with time zone");
	}

	@Test
	@DisplayName("목록·답글 인덱스가 있다")
	void indexesExist() {
		List<String> names = jdbc.queryForList("select indexname from pg_indexes where schemaname = current_schema() "
				+ "and tablename in ('trd_inquiry', 'trd_inquiry_reply')", String.class);
		assertThat(names).contains("ix_trd_inquiry_created", "ix_trd_inquiry_reply_inquiry");
	}

}
