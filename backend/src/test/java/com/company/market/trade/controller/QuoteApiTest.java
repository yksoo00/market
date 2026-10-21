package com.company.market.trade.controller;

import java.util.UUID;

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
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 견적 요청 API (스펙 2026-10-20-quote-request-design.md) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class QuoteApiTest {

	static final String REG_A = "20261020100000";

	static final String REG_B = "20261020100001";

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

	UUID sellerId;

	UUID buyerId;

	Cookie seller;

	Cookie buyer;

	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = newUser("quoteseller", "01022220001");
		buyerId = newUser("quotebuyer", "01022220002");
		seller = cookieOf(sellerId);
		buyer = cookieOf(buyerId);
		listing(REG_A, "QUOTEAPI01", "서버 R740", 1000, 10);
		listing(REG_B, "QUOTEAPI02", "스위치 C9300", 500, 100);
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_trade_history");
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
		jdbc.update("delete from trd_user_info");
	}

	private UUID newUser(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).nicknameUsage("Y").email(loginId + "@example.com").name("홍길동").phone(phone)
			.phoneHash(hasher.hash(phone)).build()).getId();
	}

	private Cookie cookieOf(UUID id) {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(id));
	}

	private void listing(String regDate, String prodId, String name, int price, int stock) {
		productRepository.saveAndFlush(Product.builder().prodId(prodId).categoryCode("P01-Q01-R001")
			.prodName(name).prodBrand("Dell").regDate(regDate).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(regDate).prodId(prodId)
			.tradeType("등록").prodState("신품").salesUnitPrice(price).salesQuantity(stock).stockQuantity(stock)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
	}

	private static String item(UUID seller, String regDate, int price, int quantity) {
		return """
				{"sellerId":"%s","regDate":"%s","orderUnitPrice":%d,"orderQuantity":%d,"remarks":"단가 조정 부탁"}
				""".formatted(seller, regDate, price, quantity);
	}

	private ResultActions quotes(Cookie who, String... items) throws Exception {
		return mvc.perform(post("/api/v1/trades/quotes").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[" + String.join(",", items) + "]}"));
	}

	private int tradeCount() {
		return jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class);
	}

	@Test
	@DisplayName("여러 매물에 견적 요청: 매물마다 견적조정/견적요청 1행, 재고 그대로, 납품희망일 없음")
	void requestQuotesForSeveralListings() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 900, 2), item(sellerId, REG_B, 450, 10))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data", hasSize(2)))
			.andExpect(jsonPath("$.data[0].tradeType").value("quote"))
			.andExpect(jsonPath("$.data[0].tradeStats").value("quoteRequested"))
			.andExpect(jsonPath("$.data[0].salesUnitPrice").value(1000))
			.andExpect(jsonPath("$.data[0].orderUnitPrice").value(900))
			.andExpect(jsonPath("$.data[0].reqDeliDate").doesNotExist());

		var row = jdbc.queryForMap("select * from trd_trade_info where reg_date = ?", REG_A);
		assertThat(row.get("trade_type")).isEqualTo("견적조정");
		assertThat(row.get("trade_stats")).isEqualTo("견적요청");
		assertThat(row.get("order_unit_price")).isEqualTo(900);
		assertThat(row.get("sales_unit_price")).isEqualTo(1000);
		assertThat(row.get("req_deli_date")).isNull();
		assertThat(row.get("remarks")).isEqualTo("단가 조정 부탁");
		assertThat(jdbc.queryForObject("select stock_quantity from trd_prod_reg where reg_date = ?", Integer.class, REG_A))
			.isEqualTo(10);
	}

	@Test
	@DisplayName("하나라도 틀리면 아무것도 저장 안 됨 — 희망단가 > 등록단가는 400 fields[items[1].orderUnitPrice]")
	void oneInvalidItemRejectsAll() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 900, 1), item(sellerId, REG_B, 501, 1))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[1].orderUnitPrice']").exists());
		assertThat(tradeCount()).isZero();
	}

	@Test
	@DisplayName("수량 규칙(재고 초과)·희망단가 0·21개는 400")
	void invalidInputs() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 900, 11)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[0].orderQuantity']").exists());
		quotes(buyer, item(sellerId, REG_A, 0, 1)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[0].orderUnitPrice']").exists());
		String[] many = new String[21];
		java.util.Arrays.fill(many, item(sellerId, REG_A, 900, 1));
		quotes(buyer, many).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.items").exists());
		quotes(buyer).andExpect(status().isBadRequest());
		assertThat(tradeCount()).isZero();
	}

	@Test
	@DisplayName("내 매물 403, 거래완료 409, 같은 매물에 대기 중 견적이 있으면 409 QUOTE_ALREADY_REQUESTED, 비로그인 401")
	void blockedCases() throws Exception {
		quotes(seller, item(sellerId, REG_A, 900, 1)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("TRADE_OWN_LISTING"));

		jdbc.update("update trd_prod_reg set stock_quantity = 0, dt_expire = '20261020100000' where reg_date = ?", REG_B);
		quotes(buyer, item(sellerId, REG_B, 400, 1)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("LISTING_COMPLETED"));

		quotes(buyer, item(sellerId, REG_A, 900, 1)).andExpect(status().isCreated());
		quotes(buyer, item(sellerId, REG_A, 800, 1)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("QUOTE_ALREADY_REQUESTED"));
		assertThat(tradeCount()).isEqualTo(1);

		mvc.perform(post("/api/v1/trades/quotes").contentType(MediaType.APPLICATION_JSON)
				.content("{\"items\":[" + item(sellerId, REG_A, 900, 1) + "]}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("같은 Idempotency-Key 로 다시 보내면 처음 결과를 돌려주고 행은 그대로")
	void idempotentQuotes() throws Exception {
		String body = "{\"items\":[" + item(sellerId, REG_A, 900, 1) + "," + item(sellerId, REG_B, 450, 1) + "]}";
		String key = UUID.randomUUID().toString();
		String first = mvc.perform(post("/api/v1/trades/quotes").cookie(buyer).header("Idempotency-Key", key)
				.contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		String second = mvc.perform(post("/api/v1/trades/quotes").cookie(buyer).header("Idempotency-Key", key)
				.contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		assertThat(second).isEqualTo(first);
		assertThat(tradeCount()).isEqualTo(2);
	}

}
