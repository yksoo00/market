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
		jdbc.update("delete from trd_trade_history");
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
		jdbc.update("delete from trd_user_info");
	}

	private void insertUser(String userId, String email, String userClass, String busRegId) {
		jdbc.update("""
				insert into trd_user_info (user_id, password, user_class, user_name, user_email, bus_reg_id, company_type,
					company_name, company_open_date, dt_reg, dt_update)
				values (?, 'hashed', ?, '사용자', ?, ?, case when ? = 'business' then 'corporate' else null end,
					case when ? = 'business' then '회사' else null end,
					case when ? = 'business' then '20200101' else null end,
					'20260928120000', '20260928120000')
				""", userId, userClass, email, busRegId, userClass, userClass, userClass);
	}

	@Test
	@DisplayName("사용자 ID와 이메일은 중복될 수 없다")
	void activeIdsAndEmailsAreUnique() {
		insertUser("user004", "Same@Example.com", "personal", null);
		assertThatThrownBy(() -> insertUser("user004", "other@x.com", "personal", null))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertUser("user005", "same@example.com", "personal", null))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("기업 계정은 회사 식별 필드가 필요하고 사업자번호는 중복될 수 없다")
	void businessAccountNeedsCompanyFieldsAndUniqueNumber() {
		assertThatThrownBy(() -> jdbc.update("""
				insert into trd_user_info (user_id, password, user_class, user_name, dt_reg, dt_update)
				values ('biz001', 'hashed', 'business', '담당자', '20260928120000', '20260928120000')
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
		String[][] columns = { { "trd_prod_master", "prod_mpn" }, { "trd_prod_master", "prod_scan_code" },
				{ "trd_prod_reg", "prov_date" }, { "trd_prod_reg", "prod_coa" }, { "trd_user_info", "uid" },
				{ "trd_trade_info", "seller_id" }, { "trd_trade_info", "trade_stats" },
				{ "trd_trade_history", "buyer_id" }, { "trd_trade_history", "trade_amount" } };
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

	/** 판매자·매물·구매자 한 벌을 만들고 [구매자 uid, 판매자 uid] 를 돌려준다. 매물 키는 (판매자, '20261015100000') */
	private UUID[] insertListingAndBuyer() {
		insertUser("seller01", "seller@example.com", "personal", null);
		insertUser("buyer01", "buyer@example.com", "personal", null);
		UUID seller = jdbc.queryForObject("select uid from trd_user_info where user_id = 'seller01'", UUID.class);
		UUID buyer = jdbc.queryForObject("select uid from trd_user_info where user_id = 'buyer01'", UUID.class);
		jdbc.update("""
				insert into trd_prod_master (prod_id, category_code, prod_name, prod_brand, reg_date)
				values ('TRADETEST1', 'P01-Q01-R001', '상품', '브랜드', '20261015100000')
				""");
		jdbc.update("""
				insert into trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price, sales_quantity)
				values (?, '20261015100000', 'TRADETEST1', '판매', '신품', 1000, 10)
				""", seller);
		return new UUID[] { buyer, seller };
	}

	private void insertTrade(UUID buyer, UUID seller, String tradeId) {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, req_deli_date, trade_stats)
				values (?, ?, '구매요청', ?, '20261015100000', 'TRADETEST1', 1000, 1, '2026-10-20', '구매요청')
				""", buyer, tradeId, seller);
	}

	@Test
	@DisplayName("거래 테이블: trade_id 는 유일하고, 이력은 없는 거래를 가리킬 수 없다")
	void tradeIdUniqueAndHistoryForeignKey() {
		UUID[] ids = insertListingAndBuyer();
		insertTrade(ids[0], ids[1], "26101510001");
		// 구매자가 달라도 같은 trade_id 는 안 된다 (이력 FK 가 trade_id 하나로 거래를 가리키므로)
		assertThatThrownBy(() -> insertTrade(ids[1], ids[1], "26101510001"))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update("""
				insert into trd_trade_history (trade_id, trade_date, prod_id, trade_type, seller_id, buyer_id)
				values ('26101599999', '20261015120000', 'TRADETEST1', '구매확정', ?, ?)
				""", ids[1], ids[0])).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("견적조정 행은 납품희망일 없이 저장된다 (req_deli_date nullable, 2026-10-20)")
	void quoteRowWithoutReqDeliDate() {
		UUID[] ids = insertListingAndBuyer();
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, req_deli_date, trade_stats)
				values (?, '26102010001', '견적조정', ?, '20261015100000', 'TRADETEST1', 900, 1, null, '견적요청')
				""", ids[0], ids[1]);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where req_deli_date is null", Integer.class))
			.isEqualTo(1);
	}

	@Test
	@DisplayName("거래 매물 FK: 거래가 있는 매물은 지울 수 없다")
	void listingWithTradeCannotBeDeleted() {
		UUID[] ids = insertListingAndBuyer();
		insertTrade(ids[0], ids[1], "26101510001");
		assertThatThrownBy(() -> jdbc.update("delete from trd_prod_reg where user_id = ?", ids[1]))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("trd_prod_master.category_code 가 카테고리에 없으면 외래키가 거부한다")
	void productCategoryForeignKey() {
		assertThatThrownBy(() -> jdbc.update("""
				insert into trd_prod_master (prod_id, category_code, prod_name, prod_brand, reg_date)
				values ('FKTEST0001', 'NOPE-CODE', '상품', '브랜드', '20261013120000')
				""")).isInstanceOf(DataIntegrityViolationException.class);
	}

}
