package com.company.market.devtools;


import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 임시 테이블 [삭제]는 외래키가 없어 남는 자식 행도 같이 지운다 (사용자 지시 2026-11-03, DevTableRelations).
 * 매물 L 한 개에 거래 2건(구매 후 확정 1건 → 거래이력 1줄, 비교용 1건 → 장바구니 정보 1줄)을 만들어 확인한다
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DevTableCascadeTest {

	static final String REG = "20261103100000";

	static final String PROD = "DEVCASCADE01";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	JwtProvider jwtProvider;

	@Autowired
	ListingRepository listingRepository;

	@Autowired
	ProductRepository productRepository;

	String sellerId;

	String buyerId;

	Cookie buyer;

	@BeforeEach
	void setUp() throws Exception {
		cleanUp();
		sellerId = newUser("devcsel", "01055550001");
		buyerId = newUser("devcbuy", "01055550002");
		buyer = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(buyerId));
		productRepository.saveAndFlush(Product.builder().prodId(PROD).majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName("연쇄삭제 상품").prodBrand("Dell").regDate(REG).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(REG).prodId(PROD).tradeType("등록").prodState("신품")
			.salesUnitPrice(1000).salesQuantity(10).stockQuantity(10).minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
		// 구매 → 확정(거래이력 1줄) → 같은 매물을 비교에 담기(비교용 거래 1건 + 장바구니 정보 1줄)
		mvc.perform(post("/api/v1/trades").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}".formatted(sellerId, REG)))
			.andExpect(status().isCreated());
		String tradeId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '거래'", String.class);
		mvc.perform(post("/api/v1/trades/" + tradeId + "/complete").cookie(buyer)).andExpect(status().isOk());
		mvc.perform(post("/api/v1/cart/compare").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\"}]}".formatted(sellerId, REG)))
			.andExpect(status().isOk());
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_cart_info");
		jdbc.update("delete from trd_trade_history");
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
		jdbc.update("delete from trd_user_info");
	}

	private String newUser(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).nicknameUsage("Y").email(loginId + "@example.com").name("홍길동").phone(phone)
			.phoneHash(hasher.hash(phone)).build()).getId();
	}

	private int count(String table) {
		return jdbc.queryForObject("select count(*) from " + table, Integer.class);
	}

	private String listingKey() {
		return "{\"user_id\":\"%s\",\"reg_date\":\"%s\",\"prod_id\":\"%s\"}".formatted(sellerId, REG, PROD);
	}

	@Test
	@DisplayName("미리보기: 매물을 지우면 같이 지워질 다른 테이블의 행 수(거래 2·장바구니 정보 1·거래이력 1)를 알려 준다 — 매물 자신은 세지 않는다")
	void relatedRowsOfListing() throws Exception {
		mvc.perform(post("/api/v1/dev/tables/trd_prod_reg/rows/related").contentType(MediaType.APPLICATION_JSON).content(listingKey()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.related.trd_trade_info").value(2))
			.andExpect(jsonPath("$.data.related.trd_cart_info").value(1))
			.andExpect(jsonPath("$.data.related.trd_trade_history").value(1))
			.andExpect(jsonPath("$.data.related.trd_prod_reg").doesNotExist());
		// 미리보기는 아무것도 지우지 않는다
		assertThat(count("trd_prod_reg")).isEqualTo(1);
		assertThat(count("trd_trade_info")).isEqualTo(2);
	}

	@Test
	@DisplayName("매물 삭제는 그 매물의 거래·장바구니 정보·거래이력을 같이 지우고, 부모(상품마스터·사용자)는 그대로 둔다")
	void deletingListingCascadesToChildrenOnly() throws Exception {
		mvc.perform(delete("/api/v1/dev/tables/trd_prod_reg/rows").contentType(MediaType.APPLICATION_JSON).content(listingKey()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.deleted").value(5))
			.andExpect(jsonPath("$.data.tables.trd_prod_reg").value(1))
			.andExpect(jsonPath("$.data.tables.trd_trade_info").value(2));
		assertThat(count("trd_prod_reg")).isZero();
		assertThat(count("trd_trade_info")).isZero();
		assertThat(count("trd_cart_info")).isZero();
		assertThat(count("trd_trade_history")).isZero();
		assertThat(count("trd_prod_master")).isEqualTo(1);
		assertThat(count("trd_user_info")).isEqualTo(2);
	}

	@Test
	@DisplayName("거래 삭제는 그 거래의 장바구니 정보·거래이력만 같이 지우고 매물과 다른 거래는 그대로")
	void deletingTradeCascadesToItsRowsOnly() throws Exception {
		String compareTradeId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_stats = '비교용'", String.class);
		mvc.perform(delete("/api/v1/dev/tables/trd_trade_info/rows").contentType(MediaType.APPLICATION_JSON)
			.content("{\"user_id\":\"%s\",\"trade_id\":\"%s\"}".formatted(buyerId, compareTradeId)))
			.andExpect(status().isOk()).andExpect(jsonPath("$.data.deleted").value(2));
		assertThat(count("trd_trade_info")).isEqualTo(1);
		assertThat(count("trd_cart_info")).isZero();
		// 거래(확정)와 그 거래이력, 매물은 그대로
		assertThat(count("trd_trade_history")).isEqualTo(1);
		assertThat(count("trd_prod_reg")).isEqualTo(1);
	}

	@Test
	@DisplayName("사용자 삭제는 그 사용자의 거래·장바구니·거래이력을 지우고, 다른 사용자(판매자)와 그 매물은 그대로")
	void deletingUserCascadesToTheirRows() throws Exception {
		mvc.perform(delete("/api/v1/dev/tables/trd_user_info/rows").contentType(MediaType.APPLICATION_JSON).content("{\"uid\":\"%s\"}".formatted(buyerId)))
			.andExpect(status().isOk());
		assertThat(count("trd_user_info")).isEqualTo(1);
		assertThat(count("trd_trade_info")).isZero();
		assertThat(count("trd_cart_info")).isZero();
		assertThat(count("trd_trade_history")).isZero();
		assertThat(count("trd_prod_reg")).isEqualTo(1);
	}

	@Test
	@DisplayName("자식이 없는 행·없는 행: 자식 없으면 그 행만 지우고, 없는 행은 404 (아무것도 안 지움)")
	void noChildrenAndMissingRow() throws Exception {
		mvc.perform(post("/api/v1/dev/tables/trd_trade_history/rows/related").contentType(MediaType.APPLICATION_JSON)
			.content("{\"user_id\":\"%s\",\"trade_id\":\"nope\",\"trade_date\":\"20260101000000\"}".formatted(buyerId)))
			.andExpect(status().isNotFound());
		mvc.perform(delete("/api/v1/dev/tables/trd_prod_reg/rows").contentType(MediaType.APPLICATION_JSON)
			.content("{\"user_id\":\"%s\",\"reg_date\":\"20990101000000\",\"prod_id\":\"%s\"}".formatted(sellerId, PROD)))
			.andExpect(status().isNotFound());
		assertThat(count("trd_prod_reg")).isEqualTo(1);
		assertThat(count("trd_trade_info")).isEqualTo(2);
	}

}
