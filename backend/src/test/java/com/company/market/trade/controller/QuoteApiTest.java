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
	@DisplayName("내 매물 403, 거래완료 409, 한 요청에 같은 매물이 두 번이면 409 QUOTE_ALREADY_REQUESTED, 비로그인 401")
	void blockedCases() throws Exception {
		quotes(seller, item(sellerId, REG_A, 900, 1)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("TRADE_OWN_LISTING"));

		jdbc.update("update trd_prod_reg set stock_quantity = 0, dt_expire = '20261020100000' where reg_date = ?", REG_B);
		quotes(buyer, item(sellerId, REG_B, 400, 1)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("LISTING_COMPLETED"));

		quotes(buyer, item(sellerId, REG_A, 900, 1), item(sellerId, REG_A, 800, 1)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("QUOTE_ALREADY_REQUESTED"));
		assertThat(tradeCount()).isZero();

		mvc.perform(post("/api/v1/trades/quotes").contentType(MediaType.APPLICATION_JSON)
				.content("{\"items\":[" + item(sellerId, REG_A, 900, 1) + "]}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("앞 칸이 틀려도 한 요청의 같은 매물 중복은 먼저 409")
	void duplicateIsReportedEvenIfEarlierItemIsInvalid() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 9999, 1), item(sellerId, REG_A, 800, 1)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("QUOTE_ALREADY_REQUESTED"));
	}

	@Test
	@DisplayName("같은 매물에 다시 견적 요청 — 새 행 없이 기존 행을 덮어쓴다 (단가·수량·비고, 상태 견적요청)")
	void requoteOverwritesPending() throws Exception {
		String tradeId = quoted(REG_A, 900);
		quotes(buyer, item(sellerId, REG_A, 800, 3)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.data[0].tradeId").value(tradeId))
			.andExpect(jsonPath("$.data[0].orderUnitPrice").value(800));
		assertThat(tradeCount()).isEqualTo(1);
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", tradeId);
		assertThat(row.get("order_unit_price")).isEqualTo(800);
		assertThat(row.get("order_quantity")).isEqualTo(3);
		assertThat(row.get("trade_stats")).isEqualTo("견적요청");
	}

	@Test
	@DisplayName("거절·수락으로 견적회신이 된 뒤 다시 요청하면 같은 행이 견적요청으로 돌아간다. 매물 정보도 새로 읽는다")
	void requoteAfterReply() throws Exception {
		String rejected = quoted(REG_A, 900);
		action(seller, rejected, "reject").andExpect(status().isOk());
		quotes(buyer, item(sellerId, REG_A, 850, 1)).andExpect(status().isCreated());
		assertThat(tradeCount()).isEqualTo(1);
		assertThat(statsOf(rejected)).isEqualTo("견적요청");

		action(seller, rejected, "accept").andExpect(status().isOk());
		assertThat(priceOf(REG_A)).isEqualTo(850);
		quotes(buyer, item(sellerId, REG_A, 800, 1)).andExpect(status().isCreated());
		assertThat(tradeCount()).isEqualTo(1);
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", rejected);
		assertThat(row.get("trade_stats")).isEqualTo("견적요청");
		assertThat(row.get("sales_unit_price")).isEqualTo(850);
		assertThat(row.get("order_unit_price")).isEqualTo(800);
	}

	@Test
	@DisplayName("구매요청 행과 견적 행은 따로 — 직접 구매가 있어도 견적은 새 행, 견적을 덮어써도 구매 행은 그대로")
	void quoteRowIsSeparateFromPurchaseRow() throws Exception {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, req_deli_date, trade_stats)
				values (?, '26102010999', '거래', ?, ?, 'QUOTEAPI01', 1000, 1, '2099-12-31', '구매요청')
				""", buyerId, sellerId, REG_A);
		quotes(buyer, item(sellerId, REG_A, 900, 1)).andExpect(status().isCreated());
		quotes(buyer, item(sellerId, REG_A, 800, 1)).andExpect(status().isCreated());
		assertThat(tradeCount()).isEqualTo(2);
		assertThat(jdbc.queryForObject("select order_unit_price from trd_trade_info where trade_id = '26102010999'", Integer.class))
			.isEqualTo(1000);
	}

	@Test
	@DisplayName("DB 는 구매자·매물당 견적 행을 하나만 허용한다 (동시 요청 방어)")
	void databaseRejectsSecondQuoteRow() {
		insertQuoteRow("26102010001");
		org.assertj.core.api.Assertions.assertThatThrownBy(() -> insertQuoteRow("26102010002"))
			.isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
	}

	private void insertQuoteRow(String tradeId) {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, trade_stats)
				values (?, ?, '견적조정', ?, ?, 'QUOTEAPI01', 900, 1, '견적요청')
				""", buyerId, tradeId, sellerId, REG_A);
	}

	// ---- 회신·취소 ----

	private String quoted(String regDate, int price) throws Exception {
		quotes(buyer, item(sellerId, regDate, price, 1)).andExpect(status().isCreated());
		return jdbc.queryForObject("select trade_id from trd_trade_info where reg_date = ? and trade_stats = '견적요청'",
				String.class, regDate);
	}

	private ResultActions action(Cookie who, String tradeId, String what) throws Exception {
		return mvc.perform(post("/api/v1/trades/" + tradeId + "/" + what).cookie(who));
	}

	private int priceOf(String regDate) {
		return jdbc.queryForObject("select sales_unit_price from trd_prod_reg where reg_date = ?", Integer.class, regDate);
	}

	private String statsOf(String tradeId) {
		return jdbc.queryForObject("select trade_stats from trd_trade_info where trade_id = ?", String.class, tradeId);
	}

	@Test
	@DisplayName("판매자 수락: 매물 단가 = 희망단가, 견적회신. 두 번째 수락·거절은 409")
	void sellerAccepts() throws Exception {
		String tradeId = quoted(REG_A, 900);
		action(seller, tradeId, "accept").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tradeStats").value("quoteReplied"));
		assertThat(priceOf(REG_A)).isEqualTo(900);
		assertThat(statsOf(tradeId)).isEqualTo("견적회신");
		action(seller, tradeId, "accept").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("TRADE_NOT_PENDING"));
		action(seller, tradeId, "reject").andExpect(status().isConflict());
	}

	@Test
	@DisplayName("수락 때 매물이 이미 희망단가보다 싸면 단가를 올리지 않는다")
	void acceptDoesNotRaisePrice() throws Exception {
		String tradeId = quoted(REG_A, 900);
		jdbc.update("update trd_prod_reg set sales_unit_price = 800 where reg_date = ?", REG_A);
		action(seller, tradeId, "accept").andExpect(status().isOk());
		assertThat(priceOf(REG_A)).isEqualTo(800);
	}

	@Test
	@DisplayName("거래완료 매물은 수락 409 LISTING_COMPLETED, 견적은 그대로")
	void acceptCompletedListing() throws Exception {
		String tradeId = quoted(REG_A, 900);
		jdbc.update("update trd_prod_reg set stock_quantity = 0, dt_expire = '20261020100000' where reg_date = ?", REG_A);
		action(seller, tradeId, "accept").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("LISTING_COMPLETED"));
		assertThat(statsOf(tradeId)).isEqualTo("견적요청");
	}

	@Test
	@DisplayName("판매자 거절: 단가 그대로, 견적회신. 구매자·남은 수락·거절 403")
	void sellerRejectsOthersForbidden() throws Exception {
		String tradeId = quoted(REG_A, 900);
		Cookie stranger = cookieOf(newUser("quotestranger", "01022220009"));
		action(buyer, tradeId, "accept").andExpect(status().isForbidden());
		action(stranger, tradeId, "reject").andExpect(status().isForbidden());

		action(seller, tradeId, "reject").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tradeStats").value("quoteReplied"));
		assertThat(priceOf(REG_A)).isEqualTo(1000);
		assertThat(statsOf(tradeId)).isEqualTo("견적회신");
	}

	@Test
	@DisplayName("구매자 견적 취소: 행 삭제(204). 판매자는 견적을 취소 못 함 403. 회신 뒤 취소 409")
	void buyerCancelsQuote() throws Exception {
		String tradeId = quoted(REG_A, 900);
		action(seller, tradeId, "cancel").andExpect(status().isForbidden());
		action(buyer, tradeId, "cancel").andExpect(status().isNoContent());
		assertThat(tradeCount()).isZero();

		String replied = quoted(REG_A, 900);
		action(seller, replied, "reject").andExpect(status().isOk());
		action(buyer, replied, "cancel").andExpect(status().isConflict());
	}

	@Test
	@DisplayName("구매요청 거래에는 수락·거절이 없다 — 409")
	void acceptOnlyQuotes() throws Exception {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, req_deli_date, trade_stats)
				values (?, '26102010999', '거래', ?, ?, 'QUOTEAPI01', 1000, 1, '2099-12-31', '구매요청')
				""", buyerId, sellerId, REG_A);
		action(seller, "26102010999", "accept").andExpect(status().isConflict());
	}

	@Test
	@DisplayName("pending-counts 는 판매자가 처리할 견적요청 + 구매요청")
	void pendingCountsIncludeQuotes() throws Exception {
		quoted(REG_A, 900);
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id,
					order_unit_price, order_quantity, req_deli_date, trade_stats)
				values (?, '26102010999', '거래', ?, ?, 'QUOTEAPI01', 1000, 1, '2099-12-31', '구매요청')
				""", buyerId, sellerId, REG_A);
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/trades/pending-counts")
				.cookie(seller))
			.andExpect(jsonPath("$.data['" + REG_A + "']").value(2));
	}

	@Test
	@DisplayName("수락과 구매자 취소가 동시에 오면 하나만 성공 — 단가는 수락이 이긴 경우에만 바뀐다")
	void concurrentAcceptAndCancel() throws Exception {
		String tradeId = quoted(REG_A, 900);
		java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
		java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
		var accept = pool.submit(() -> {
			start.await();
			return action(seller, tradeId, "accept").andReturn().getResponse().getStatus();
		});
		var cancel = pool.submit(() -> {
			start.await();
			return action(buyer, tradeId, "cancel").andReturn().getResponse().getStatus();
		});
		start.countDown();
		int accepted = accept.get();
		int canceled = cancel.get();
		pool.shutdown();

		assertThat((accepted == 200) ^ (canceled == 204)).isTrue();
		// 진 쪽은 교착·500 이 아니라 409(이미 처리됨) 또는 404(취소로 행이 지워짐)
		assertThat(accepted == 200 ? canceled : accepted).isIn(404, 409);
		assertThat(priceOf(REG_A)).isEqualTo(accepted == 200 ? 900 : 1000);
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
