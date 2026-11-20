package com.company.market;


import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
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
		jdbc.update("delete from trd_cart_info");
		jdbc.update("delete from trd_trade_history");
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
		jdbc.update("delete from trd_user_info");
	}

	private void insertUser(String userId, String email, String userClass, String busRegId) {
		jdbc.update("""
				insert into trd_user_info (uid, user_id, password, user_class, user_name, user_email, bus_reg_id, company_type,
					company_name, company_open_date, dt_reg, dt_update)
				values (substr('UT' || md5(?), 1, 11), ?, 'hashed', ?, '사용자', ?, ?, case when ? = 'business' then 'corporate' else null end,
					case when ? = 'business' then '회사' else null end,
					case when ? = 'business' then '20200101' else null end,
					'20260928120000', '20260928120000')
				""", userId, userId, userClass, email, busRegId, userClass, userClass, userClass);
	}

	@Test
	@DisplayName("사용자 ID 는 중복될 수 없고 이메일은 중복돼도 된다 (2026-11-20)")
	void activeIdsAreUniqueButEmailsMayRepeat() {
		insertUser("user004", "Same@Example.com", "personal", null);
		assertThatThrownBy(() -> insertUser("user004", "other@x.com", "personal", null))
			.isInstanceOf(DataIntegrityViolationException.class);
		insertUser("user005", "same@example.com", "personal", null);
	}

	@Test
	@DisplayName("기업 계정은 회사 식별 필드가 필요하고 사업자번호는 중복될 수 없다")
	void businessAccountNeedsCompanyFieldsAndUniqueNumber() {
		assertThatThrownBy(() -> jdbc.update("""
				insert into trd_user_info (uid, user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('UTBIZ000001', 'biz001', 'hashed', 'business', '담당자', '20260928120000', '20260928120000')
				""")).isInstanceOf(DataIntegrityViolationException.class);

		insertUser("biz002", "biz1@example.com", "business", "1234567890");
		assertThatThrownBy(() -> insertUser("biz003", "biz2@example.com", "business", "1234567890"))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("trd_user_info 에 role·status·deleted_at·must_change_password·user_tel 이 없다")
	void droppedUserColumns() {
		assertThat(jdbc.queryForList("select column_name from information_schema.columns "
				+ "where table_schema = current_schema() and table_name = 'trd_user_info' "
				+ "and column_name in ('role', 'status', 'deleted_at', 'must_change_password', 'user_tel')",
				String.class)).isEmpty();
	}

	@Test
	@DisplayName("정의서 물리명: trd_prod_master·trd_prod_reg·trd_user_info·trd_trade_info·trd_trade_history 의 정의서 컬럼이 있다")
	void legacyPhysicalNames() {
		String[][] columns = { { "trd_prod_master", "prod_part_no" }, { "trd_prod_master", "prod_image" },
				{ "trd_prod_reg", "prov_date" }, { "trd_prod_reg", "certificate_of_authenticity" },
				{ "trd_user_info", "uid" }, { "trd_trade_info", "seller_id" }, { "trd_trade_info", "trade_stats" },
				{ "trd_trade_info", "prod_reg_date" }, { "trd_trade_info", "reg_date" },
				{ "trd_trade_history", "user_id" }, { "trd_trade_history", "trade_amount" } };
		for (String[] c : columns) {
			assertThat(jdbc.queryForObject("select count(*) from information_schema.columns "
					+ "where table_schema = current_schema() and table_name = ? and column_name = ?",
					Integer.class, c[0], c[1])).as(c[0] + "." + c[1]).isEqualTo(1);
		}
		assertThat(jdbc.queryForObject("select count(*) from information_schema.tables "
				+ "where table_schema = current_schema() and table_name in ('products', 'listings', 'users')",
				Integer.class)).isZero();
	}

	@Test
	@DisplayName("trd_ctgr_code 에 시드가 있고 P01-Q01-R001 의 부모는 Q01")
	void categorySeedExists() {
		assertThat(jdbc.queryForObject("select count(*) from trd_ctgr_code", Integer.class)).isEqualTo(239);
		assertThat(jdbc.queryForObject("select parent_code from trd_ctgr_code where category_code = 'P01-Q01-R001'",
				String.class)).isEqualTo("Q01");
	}

	/** 컬럼 하나의 "타입(길이) nullable" — 예: "character varying(40) YES" */
	private String column(String table, String column) {
		return jdbc.queryForObject("""
				select data_type || coalesce('(' || character_maximum_length || ')', '') || ' ' || is_nullable
				  from information_schema.columns
				 where table_schema = current_schema() and table_name = ? and column_name = ?
				""", String.class, table, column);
	}

	@Test
	@DisplayName("trd_ctgr_master: PK category_code varchar(12), parent_code 만 nullable (정의서 + 사용자 결정 2026-10-27)")
	void categoryMasterColumns() {
		assertThat(jdbc.queryForList("""
				select k.column_name from information_schema.table_constraints c
				  join information_schema.key_column_usage k on k.constraint_name = c.constraint_name
				   and k.table_schema = c.table_schema
				 where c.table_schema = current_schema() and c.table_name = 'trd_ctgr_master'
				   and c.constraint_type = 'PRIMARY KEY'
				""", String.class)).containsExactly("category_code");
		assertThat(column("trd_ctgr_master", "category_code")).isEqualTo("character varying(12) NO");
		assertThat(column("trd_ctgr_master", "category_name")).isEqualTo("character varying(50) NO");
		assertThat(column("trd_ctgr_master", "category_depth")).isEqualTo("character varying(2) NO");
		assertThat(column("trd_ctgr_master", "parent_code")).isEqualTo("character varying(20) YES");
		assertThat(column("trd_ctgr_master", "is_display")).isEqualTo("character(1) NO");
		assertThat(column("trd_ctgr_master", "sort_order")).isEqualTo("integer YES");
		assertThat(column("trd_ctgr_master", "reg_date")).isEqualTo("character varying(14) NO");
		assertThat(column("trd_ctgr_master", "spare_col")).isEqualTo("character varying(10) YES");
	}

	@Test
	@DisplayName("trd_prod_master 정의서 컬럼: 조각 카테고리·새 칸, 제조사 40 nullable, 옛 칸·unique 없음 (2026-10-27 설계 PR 2)")
	void productMasterDefinitionColumns() {
		assertThat(column("trd_prod_master", "prod_id")).isEqualTo("character varying(20) NO");
		assertThat(column("trd_prod_master", "prod_name")).isEqualTo("character varying(50) YES");
		assertThat(column("trd_prod_master", "prod_part_no")).isEqualTo("character varying(20) YES");
		assertThat(column("trd_prod_master", "prod_brand")).isEqualTo("character varying(40) YES");
		assertThat(column("trd_prod_master", "prod_class_no")).isEqualTo("character varying(20) YES");
		for (String c : new String[] { "major_category", "middle_category", "minor_category", "alter_prod_name" }) {
			assertThat(column("trd_prod_master", c)).as(c).isEqualTo("character varying(40) YES");
		}
		assertThat(column("trd_prod_master", "prod_spec_info")).isEqualTo("character varying(100) YES");
		assertThat(column("trd_prod_master", "prod_useful_life")).isEqualTo("integer YES");
		assertThat(column("trd_prod_master", "warranty_method")).isEqualTo("character varying(20) YES");
		assertThat(column("trd_prod_master", "prod_data_sheet")).isEqualTo("character varying(100) YES");
		assertThat(column("trd_prod_master", "prod_image")).isEqualTo("character varying(100) YES");
		assertThat(column("trd_prod_master", "reg_date")).isEqualTo("character varying(14) YES");
		assertThat(jdbc.queryForList("""
				select column_name from information_schema.columns
				 where table_schema = current_schema() and table_name = 'trd_prod_master'
				   and column_name in ('category_code', 'prod_scan_code', 'prod_mpn', 'prod_photo_1', 'prod_mufc_date')
				""", String.class)).isEmpty();
		assertThat(jdbc.queryForList("""
				select indexname from pg_indexes
				 where schemaname = current_schema() and tablename = 'trd_prod_master' and indexdef like '%UNIQUE%'
				   and indexname <> 'trd_prod_master_pkey'
				""", String.class)).isEmpty();
	}

	/** 판매자·매물·구매자 한 벌을 만들고 [구매자 uid, 판매자 uid] 를 돌려준다. 매물 키는 (판매자, '20261015100000') */
	private String[] insertListingAndBuyer() {
		insertUser("seller01", "seller@example.com", "personal", null);
		insertUser("buyer01", "buyer@example.com", "personal", null);
		String seller = jdbc.queryForObject("select uid from trd_user_info where user_id = 'seller01'", String.class);
		String buyer = jdbc.queryForObject("select uid from trd_user_info where user_id = 'buyer01'", String.class);
		jdbc.update("""
				insert into trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name, prod_brand, reg_date)
				values ('TRADETEST1', 'P01', 'Q01', 'R001', '상품', '브랜드', '20261015100000')
				""");
		insertProdReg(seller, "20261015100000", "TRADETEST1");
		return new String[] { buyer, seller };
	}

	private void insertProdReg(String seller, String regDate, String prodId) {
		jdbc.update("""
				insert into trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price,
					sales_quantity, prov_date)
				values (?, ?, ?, '판매', '신품', 1000, 10, '2026-10-20')
				""", seller, regDate, prodId);
	}

	private void insertTrade(String buyer, String seller, String tradeId) {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id,
					order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, ?, '구매요청', ?, '20261015100000', 'TRADETEST1', 1000, 1, '2026-10-20', '2026-10-20', '구매요청')
				""", buyer, tradeId, seller);
	}

	@Test
	@DisplayName("FK 가 없다 — 이력은 없는 거래를 가리켜도 저장된다 (정의서 FOREIGN KEY 는 의미상 관계, 2026-10-27)")
	void noForeignKeys() {
		assertThat(jdbc.queryForObject("""
				select count(*) from information_schema.table_constraints
				 where table_schema = current_schema() and constraint_type = 'FOREIGN KEY' and table_name like 'trd_%'
				""", Integer.class)).isZero();
		String[] ids = insertListingAndBuyer();
		jdbc.update("""
				insert into trd_trade_history (user_id, trade_id, trade_date, prod_id, trade_type, seller_id)
				values (?, '26101599999', '20261015120000', 'TRADETEST1', '거래', ?)
				""", ids[0], ids[1]);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_history", Integer.class)).isEqualTo(1);
	}

	@Test
	@DisplayName("trd_prod_reg PK 는 (user_id, reg_date, prod_id) — 상품이 다르면 같은 초도 저장, 세 값이 같으면 거부")
	void prodRegPrimaryKeyHasProdId() {
		String[] ids = insertListingAndBuyer();
		jdbc.update("""
				insert into trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name, prod_brand, reg_date)
				values ('TRADETEST2', 'P01', 'Q01', 'R001', '상품2', '브랜드', '20261015100000')
				""");
		insertProdReg(ids[1], "20261015100000", "TRADETEST2");
		assertThatThrownBy(() -> insertProdReg(ids[1], "20261015100000", "TRADETEST2"))
			.isInstanceOf(DuplicateKeyException.class);
	}

	@Test
	@DisplayName("trd_trade_info 의 prod_reg_date·prov_date·req_deli_date 는 NOT NULL (정의서)")
	void tradeInfoNotNullColumns() {
		String[] ids = insertListingAndBuyer();
		String sql = """
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id,
					order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, '26101510009', '거래', ?, ?, 'TRADETEST1', 1000, 1, ?, ?, '구매요청')
				""";
		assertThatThrownBy(() -> jdbc.update(sql, ids[0], ids[1], null, "2026-10-20", "2026-10-20")).as("prod_reg_date")
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update(sql, ids[0], ids[1], "20261015100000", null, "2026-10-20")).as("prov_date")
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update(sql, ids[0], ids[1], "20261015100000", "2026-10-20", null)).as("req_deli_date")
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("trd_cart_info: PK (user_id, trade_id, ser_no), 정의서 NOT NULL·길이 (2026-10-29 설계 PR 3)")
	void cartInfoColumns() {
		assertThat(jdbc.queryForList("""
				select k.column_name from information_schema.table_constraints c
				  join information_schema.key_column_usage k on k.constraint_name = c.constraint_name
				   and k.table_schema = c.table_schema
				 where c.table_schema = current_schema() and c.table_name = 'trd_cart_info'
				   and c.constraint_type = 'PRIMARY KEY'
				 order by k.ordinal_position
				""", String.class)).containsExactly("user_id", "trade_id", "ser_no");
		String[][] expected = { { "user_id", "character varying(11) NO" }, { "trade_id", "character varying(20) NO" }, { "ser_no", "integer NO" },
				{ "cart_type", "character varying(10) YES" }, { "seller_id", "character varying(11) YES" },
				{ "prod_date", "character varying(14) NO" }, { "prod_name", "character varying(50) NO" },
				{ "prod_no", "character varying(20) NO" }, { "manufacturer", "character varying(50) YES" },
				{ "prod_spec_info", "character varying(100) NO" },
				{ "prod_state", "character varying(20) NO" }, { "prov_date", "character varying(10) NO" },
				{ "order_unit_price", "integer NO" }, { "order_quantity", "integer NO" },
				{ "req_deli_date", "character varying(10) NO" }, { "remarks", "character varying(100) YES" },
				{ "reg_date", "character varying(14) NO" } };
		for (String[] c : expected) {
			assertThat(column("trd_cart_info", c[0])).as(c[0]).isEqualTo(c[1]);
		}
		// 제조일시는 2026-11-04 에 지웠다 (정의서 CART_INFO 에는 있지만 원본인 상품 제조일이 없어졌다)
		assertThat(jdbc.queryForList("""
				select column_name from information_schema.columns
				 where table_schema = current_schema() and table_name = 'trd_cart_info' and column_name = 'mufc_date'
				""", String.class)).isEmpty();
	}

	@Test
	@DisplayName("trd_trade_info 에 거래ID 찾기용 일반 인덱스가 있다 — PK 는 구매자가 앞자리라 거래ID 만으로는 못 탄다 (2026-10-27)")
	void tradeIdIndex() {
		assertThat(jdbc.queryForObject("""
				select indexdef from pg_indexes
				 where schemaname = current_schema() and indexname = 'ix_trd_trade_info_trade_id'
				""", String.class)).contains("(trade_id)").doesNotContain("UNIQUE");
	}

	@Test
	@DisplayName("trd_trade_history PK 는 (user_id, trade_id, trade_date)")
	void tradeHistoryPrimaryKey() {
		assertThat(jdbc.queryForList("""
				select k.column_name from information_schema.table_constraints c
				  join information_schema.key_column_usage k on k.constraint_name = c.constraint_name
				   and k.table_schema = c.table_schema
				 where c.table_schema = current_schema() and c.table_name = 'trd_trade_history'
				   and c.constraint_type = 'PRIMARY KEY'
				 order by k.ordinal_position
				""", String.class)).containsExactly("user_id", "trade_id", "trade_date");
	}

	private void insertRow(String buyer, String seller, String tradeId, String type, String stats) {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id,
					order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, ?, ?, ?, '20261015100000', 'TRADETEST1', 1000, 1, '2026-10-20', '2026-10-20', ?)
				""", buyer, tradeId, type, seller, stats);
	}

	@Test
	@DisplayName("장바구니 행은 같은 매물도 여러 줄(V202611021000 — 전엔 구매자·매물당 하나), 비교용 행은 하나. 견적 행과는 같이 있을 수 있다")
	void cartRowsRepeatPerListing() {
		String[] ids = insertListingAndBuyer();
		insertRow(ids[0], ids[1], "26102113001", "구매검토", "장바구니");
		insertRow(ids[0], ids[1], "26102113002", "구매검토", "장바구니");
		insertRow(ids[0], ids[1], "26102113005", "구매검토", "비교용");
		assertThatThrownBy(() -> insertRow(ids[0], ids[1], "26102113006", "구매검토", "비교용"))
			.isInstanceOf(DuplicateKeyException.class);
		insertRow(ids[0], ids[1], "26102113003", "견적조정", "견적요청");
		// 다른 구매자는 같은 매물을 따로 담는다
		insertUser("buyer02", "buyer2@example.com", "personal", null);
		String other = jdbc.queryForObject("select uid from trd_user_info where user_id = 'buyer02'", String.class);
		insertRow(other, ids[1], "26102113004", "구매검토", "장바구니");
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class)).isEqualTo(5);
	}

}
