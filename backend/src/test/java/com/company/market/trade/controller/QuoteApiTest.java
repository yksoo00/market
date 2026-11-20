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
		productRepository.saveAndFlush(Product.builder().prodId(prodId).majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName(name).prodBrand("Dell").regDate(regDate).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(regDate).prodId(prodId)
			.tradeType("등록").prodState("신품").salesUnitPrice(price).salesQuantity(stock).stockQuantity(stock)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("20991231").build());
	}

	private static String item(UUID seller, String regDate, int price, int quantity) {
		return item(seller, regDate, price, quantity, "20991130");
	}

	/** reqDeliDate = null 이면 칸을 빼고 보낸다 */
	private static String item(UUID seller, String regDate, int price, int quantity, String reqDeliDate) {
		return """
				{"sellerId":"%s","regDate":"%s","orderUnitPrice":%d,"orderQuantity":%d,"remarks":"단가 조정 부탁"%s}
				""".formatted(seller, regDate, price, quantity,
				reqDeliDate == null ? "" : ",\"reqDeliDate\":\"" + reqDeliDate + "\"");
	}

	private ResultActions quotes(Cookie who, String... items) throws Exception {
		return mvc.perform(post("/api/v1/trades/quotes").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[" + String.join(",", items) + "]}"));
	}

	private int tradeCount() {
		return jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class);
	}

	@Test
	@DisplayName("여러 매물에 견적 요청: 매물마다 견적조정/견적요청 1행, 재고 그대로, 납품희망일은 보낸 값")
	void requestQuotesForSeveralListings() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 900, 2), item(sellerId, REG_B, 450, 10))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data", hasSize(2)))
			.andExpect(jsonPath("$.data[0].tradeType").value("quote"))
			.andExpect(jsonPath("$.data[0].tradeStats").value("quoteRequested"))
			.andExpect(jsonPath("$.data[0].salesUnitPrice").value(1000))
			.andExpect(jsonPath("$.data[0].orderUnitPrice").value(900))
			.andExpect(jsonPath("$.data[0].reqDeliDate").value("20991130"));

		var row = jdbc.queryForMap("select * from trd_trade_info where prod_reg_date = ?", REG_A);
		assertThat(row.get("trade_type")).isEqualTo("견적조정");
		assertThat(row.get("trade_stats")).isEqualTo("견적요청");
		assertThat(row.get("order_unit_price")).isEqualTo(900);
		assertThat(row.get("sales_unit_price")).isEqualTo(1000);
		assertThat(row.get("req_deli_date")).isEqualTo("20991130");
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
	@DisplayName("견적 항목에 납품희망일이 없거나 오늘 전이면 400 fields[items[i].reqDeliDate], 아무것도 저장 안 함 (2026-10-27)")
	void quoteReqDeliDateRequired() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 900, 1, null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[0].reqDeliDate']").value("납품희망일을 입력해 주세요."));
		quotes(buyer, item(sellerId, REG_A, 900, 1), item(sellerId, REG_B, 450, 10, "20000101"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[1].reqDeliDate']").value("납품희망일은 오늘 이후 날짜로 입력하세요."));
		assertThat(tradeCount()).isZero();
	}

	@Test
	@DisplayName("견적 재요청은 납품희망일도 새 값으로 덮어쓴다")
	void requoteOverwritesReqDeliDate() throws Exception {
		String tradeId = quoted(REG_A, 900);
		quotes(buyer, item(sellerId, REG_A, 800, 3, "20991001")).andExpect(status().isCreated());
		assertThat(jdbc.queryForObject("select req_deli_date from trd_trade_info where trade_id = ?", String.class, tradeId))
			.isEqualTo("20991001");
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
	@DisplayName("거절·수락 뒤 다시 요청하면 같은 행이 견적요청으로 돌아간다. 매물 정보도 새로 읽는다")
	void requoteAfterReply() throws Exception {
		String rejected = quoted(REG_A, 900);
		action(seller, rejected, "reject").andExpect(status().isOk());
		quotes(buyer, item(sellerId, REG_A, 850, 1)).andExpect(status().isCreated());
		assertThat(tradeCount()).isEqualTo(1);
		assertThat(statsOf(rejected)).isEqualTo("견적요청");

		action(seller, rejected, "accept").andExpect(status().isOk());
		assertThat(priceOf(REG_A)).isEqualTo(1000);
		quotes(buyer, item(sellerId, REG_A, 800, 1)).andExpect(status().isCreated());
		assertThat(tradeCount()).isEqualTo(1);
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", rejected);
		assertThat(row.get("trade_stats")).isEqualTo("견적요청");
		assertThat(row.get("sales_unit_price")).isEqualTo(1000);
		assertThat(row.get("order_unit_price")).isEqualTo(800);
	}

	@Test
	@DisplayName("구매요청 행과 견적 행은 따로 — 직접 구매가 있어도 견적은 새 행, 견적을 덮어써도 구매 행은 그대로")
	void quoteRowIsSeparateFromPurchaseRow() throws Exception {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id,
					order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, '26102010999', '거래', ?, ?, 'QUOTEAPI01', 1000, 1, '2099-12-31', '2099-12-31', '구매요청')
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
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id,
					order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, ?, '견적조정', ?, ?, 'QUOTEAPI01', 900, 1, '2099-12-31', '2099-12-31', '견적요청')
				""", buyerId, tradeId, sellerId, REG_A);
	}

	// ---- 회신·취소 ----

	private String quoted(String regDate, int price) throws Exception {
		quotes(buyer, item(sellerId, regDate, price, 1)).andExpect(status().isCreated());
		return jdbc.queryForObject("select trade_id from trd_trade_info where prod_reg_date = ? and trade_stats = '견적요청'",
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
	@DisplayName("판매자 수락: 견적수락, 매물 단가는 그대로(수락 단가는 이 거래에서만), 견적 수량만큼 재고를 묶는다. 두 번째 수락·거절은 409")
	void sellerAccepts() throws Exception {
		String tradeId = quoted(REG_A, 900);
		assertThat(stockOf(REG_A)).isEqualTo(10);
		action(seller, tradeId, "accept").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tradeStats").value("quoteAccepted"));
		assertThat(priceOf(REG_A)).isEqualTo(1000);
		assertThat(jdbc.queryForObject("select order_unit_price from trd_trade_info where trade_id = ?", Integer.class, tradeId)).isEqualTo(900);
		assertThat(stockOf(REG_A)).isEqualTo(9);
		assertThat(statsOf(tradeId)).isEqualTo("견적수락");
		action(seller, tradeId, "accept").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("TRADE_NOT_PENDING"));
		action(seller, tradeId, "reject").andExpect(status().isConflict());
	}

	@Test
	@DisplayName("수락하면 그 수량이 묶인다 — 재고가 모자라면 수락 409 TRADE_OUT_OF_STOCK, 견적은 그대로 (견적을 보내는 동안엔 안 묶인다)")
	void acceptHoldsStock() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 900, 6)).andExpect(status().isCreated());
		String tradeId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_stats = '견적요청'", String.class);
		assertThat(stockOf(REG_A)).isEqualTo(10);
		// 그 사이 다른 구매자가 사 가서 재고가 3개가 됐다
		jdbc.update("update trd_prod_reg set stock_quantity = 3 where reg_date = ?", REG_A);
		action(seller, tradeId, "accept").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TRADE_OUT_OF_STOCK"));
		assertThat(statsOf(tradeId)).isEqualTo("견적요청");
		assertThat(stockOf(REG_A)).isEqualTo(3);

		jdbc.update("update trd_prod_reg set stock_quantity = 10 where reg_date = ?", REG_A);
		action(seller, tradeId, "accept").andExpect(status().isOk());
		assertThat(stockOf(REG_A)).isEqualTo(4);
	}

	@Test
	@DisplayName("거래완료 매물은 수락 409 TRADE_OUT_OF_STOCK(묶을 재고가 없다), 견적은 그대로")
	void acceptCompletedListing() throws Exception {
		String tradeId = quoted(REG_A, 900);
		jdbc.update("update trd_prod_reg set stock_quantity = 0, dt_expire = '20261020100000' where reg_date = ?", REG_A);
		action(seller, tradeId, "accept").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("TRADE_OUT_OF_STOCK"));
		assertThat(statsOf(tradeId)).isEqualTo("견적요청");
	}

	@Test
	@DisplayName("판매자 거절: 단가 그대로, 견적거절. 구매자·남은 수락·거절 403")
	void sellerRejectsOthersForbidden() throws Exception {
		String tradeId = quoted(REG_A, 900);
		Cookie stranger = cookieOf(newUser("quotestranger", "01022220009"));
		action(buyer, tradeId, "accept").andExpect(status().isForbidden());
		action(stranger, tradeId, "reject").andExpect(status().isForbidden());

		action(seller, tradeId, "reject").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tradeStats").value("quoteRejected"));
		assertThat(priceOf(REG_A)).isEqualTo(1000);
		assertThat(statsOf(tradeId)).isEqualTo("견적거절");
	}

	@Test
	@DisplayName("구매자 견적 취소: 행 삭제(204). 판매자는 견적요청을 취소 못 함 403. 거절된 견적도 취소(204). 수락된 견적은 구매자·판매자 누구나 취소하고 묶인 수량이 돌아온다")
	void buyerCancelsQuote() throws Exception {
		String tradeId = quoted(REG_A, 900);
		action(seller, tradeId, "cancel").andExpect(status().isForbidden());
		action(buyer, tradeId, "cancel").andExpect(status().isNoContent());
		assertThat(tradeCount()).isZero();

		String rejected = quoted(REG_A, 900);
		action(seller, rejected, "reject").andExpect(status().isOk());
		action(buyer, rejected, "cancel").andExpect(status().isNoContent());
		assertThat(tradeCount()).isZero();

		String accepted = quoted(REG_A, 900);
		action(seller, accepted, "accept").andExpect(status().isOk());
		assertThat(stockOf(REG_A)).isEqualTo(9);
		Cookie stranger = cookieOf(newUser("quotestranger3", "01022220007"));
		action(stranger, accepted, "cancel").andExpect(status().isForbidden());
		action(buyer, accepted, "cancel").andExpect(status().isNoContent());
		assertThat(tradeCount()).isZero();
		assertThat(stockOf(REG_A)).isEqualTo(10);

		String acceptedAgain = quoted(REG_A, 900);
		action(seller, acceptedAgain, "accept").andExpect(status().isOk());
		action(seller, acceptedAgain, "cancel").andExpect(status().isNoContent());
		assertThat(stockOf(REG_A)).isEqualTo(10);
	}

	@Test
	@DisplayName("수락된 견적이 있는 매물은 삭제할 수 없다 409 LISTING_HAS_TRADES(구매자 몫으로 수량이 묶여 있다). 요청·거절 견적만 있으면 지워진다")
	void listingWithAcceptedQuoteCannotBeDeleted() throws Exception {
		String accepted = acceptedQuote(REG_A, 900);
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/listings/" + sellerId + "/" + REG_A).cookie(seller))
			.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LISTING_HAS_TRADES"));
		assertThat(statsOf(accepted)).isEqualTo("견적수락");
		assertThat(stockOf(REG_A)).isEqualTo(9);

		action(buyer, accepted, "cancel").andExpect(status().isNoContent());
		quoted(REG_A, 900);
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/listings/" + sellerId + "/" + REG_A).cookie(seller))
			.andExpect(status().isNoContent());
		assertThat(tradeCount()).isZero();
	}

	// ---- 수락된 견적에서 [구매] — 같은 행이 구매요청 → 구매확정으로 이어진다 (사용자 결정 2026-10-21) ----

	private ResultActions buyFromQuote(Cookie who, String tradeId, int quantity) throws Exception {
		return mvc.perform(post("/api/v1/trades/" + tradeId + "/purchase").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"orderQuantity\":%d,\"reqDeliDate\":\"2099-12-31\",\"remarks\":\"납품 전 연락\"}".formatted(quantity)));
	}

	private int stockOf(String regDate) {
		return jdbc.queryForObject("select stock_quantity from trd_prod_reg where reg_date = ?", Integer.class, regDate);
	}

	private String acceptedQuote(String regDate, int price) throws Exception {
		String tradeId = quoted(regDate, price);
		action(seller, tradeId, "accept").andExpect(status().isOk());
		return tradeId;
	}

	@Test
	@DisplayName("수락된 견적에서 [구매]: 새 행 없이 같은 행이 구매요청이 된다 — TYPE 견적조정 그대로, 수락 단가·수락 수량 그대로, 재고는 수락 때 이미 묶여 더 안 깎인다")
	void purchaseContinuesTheSameRow() throws Exception {
		quotes(buyer, item(sellerId, REG_A, 900, 2)).andExpect(status().isCreated());
		String tradeId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_stats = '견적요청'", String.class);
		action(seller, tradeId, "accept").andExpect(status().isOk());
		assertThat(stockOf(REG_A)).isEqualTo(8);
		buyFromQuote(buyer, tradeId, 2).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tradeId").value(tradeId))
			.andExpect(jsonPath("$.data.tradeType").value("quote"))
			.andExpect(jsonPath("$.data.tradeStats").value("requested"))
			.andExpect(jsonPath("$.data.orderUnitPrice").value(900));
		assertThat(tradeCount()).isEqualTo(1);
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", tradeId);
		assertThat(row.get("trade_type")).isEqualTo("견적조정");
		assertThat(row.get("trade_stats")).isEqualTo("구매요청");
		assertThat(row.get("order_quantity")).isEqualTo(2);
		assertThat(row.get("req_deli_date")).isEqualTo("20991231");
		assertThat(row.get("remarks")).isEqualTo("납품 전 연락");
		assertThat(stockOf(REG_A)).isEqualTo(8);
	}

	@Test
	@DisplayName("견적 [구매]는 수락된 견적만, 보낸 구매자만 — 요청·거절 상태 409, 판매자·남 403, 입력 오류 400, 수량이 수락된 것과 다르면 400(행·재고 그대로)")
	void purchaseFromQuoteGuards() throws Exception {
		String pending = quoted(REG_A, 900);
		buyFromQuote(buyer, pending, 1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TRADE_NOT_PENDING"));
		action(seller, pending, "reject").andExpect(status().isOk());
		buyFromQuote(buyer, pending, 1).andExpect(status().isConflict());
		quotes(buyer, item(sellerId, REG_A, 800, 1)).andExpect(status().isCreated());
		action(seller, pending, "accept").andExpect(status().isOk());

		Cookie stranger = cookieOf(newUser("quotestranger2", "01022220008"));
		buyFromQuote(seller, pending, 1).andExpect(status().isForbidden());
		buyFromQuote(stranger, pending, 1).andExpect(status().isForbidden());
		mvc.perform(post("/api/v1/trades/" + pending + "/purchase").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
				.content("{\"orderQuantity\":1,\"reqDeliDate\":\"2000-01-01\"}"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.reqDeliDate").exists());
		mvc.perform(post("/api/v1/trades/" + pending + "/purchase").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
				.content("{\"orderQuantity\":1}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.reqDeliDate").value("납품희망일을 입력해 주세요."));
		// 수량은 수락된 그대로 — 다르면 400 fields.orderQuantity (행·재고 그대로)
		buyFromQuote(buyer, pending, 11).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.orderQuantity").exists());
		buyFromQuote(buyer, pending, 2).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.orderQuantity").exists());
		assertThat(statsOf(pending)).isEqualTo("견적수락");
		assertThat(stockOf(REG_A)).isEqualTo(9);
		buyFromQuote(buyer, "26102199999", 1).andExpect(status().isNotFound());
	}

	@Test
	@DisplayName("[구매] 뒤 거래완료는 같은 행이 구매확정 + 거래이력 1줄. 그 매물에 새 견적을 보낼 수 있다")
	void completeThenQuoteAgain() throws Exception {
		String tradeId = acceptedQuote(REG_A, 900);
		buyFromQuote(buyer, tradeId, 1).andExpect(status().isOk());
		action(buyer, tradeId, "complete").andExpect(status().isOk()).andExpect(jsonPath("$.data.tradeStats").value("confirmed"));
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_history where trade_id = ?", Integer.class, tradeId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select trade_type from trd_trade_history where trade_id = ?", String.class, tradeId))
			.isEqualTo("거래");

		quotes(buyer, item(sellerId, REG_A, 800, 1)).andExpect(status().isCreated());
		assertThat(tradeCount()).isEqualTo(2);
		assertThat(statsOf(tradeId)).isEqualTo("구매확정");
	}

	@Test
	@DisplayName("구매요청이 된 견적 행은 재요청이 덮어쓰지 않고, 취소하면 행이 지워지고 재고가 돌아온다 (판매자도 취소 가능)")
	void purchaseStageRowIsNotOverwrittenAndCanBeCanceled() throws Exception {
		String tradeId = acceptedQuote(REG_A, 900);
		buyFromQuote(buyer, tradeId, 1).andExpect(status().isOk());
		quotes(buyer, item(sellerId, REG_A, 700, 1)).andExpect(status().isCreated());
		assertThat(tradeCount()).isEqualTo(2);
		assertThat(statsOf(tradeId)).isEqualTo("구매요청");
		assertThat(jdbc.queryForObject("select order_unit_price from trd_trade_info where trade_id = ?", Integer.class, tradeId))
			.isEqualTo(900);

		action(seller, tradeId, "cancel").andExpect(status().isNoContent());
		assertThat(tradeCount()).isEqualTo(1);
		assertThat(stockOf(REG_A)).isEqualTo(10);
	}

	@Test
	@DisplayName("구매요청 거래에는 수락·거절이 없다 — 409")
	void acceptOnlyQuotes() throws Exception {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id,
					order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, '26102010999', '거래', ?, ?, 'QUOTEAPI01', 1000, 1, '2099-12-31', '2099-12-31', '구매요청')
				""", buyerId, sellerId, REG_A);
		action(seller, "26102010999", "accept").andExpect(status().isConflict());
	}

	@Test
	@DisplayName("pending-counts 는 판매자가 처리할 견적요청 + 구매요청")
	void pendingCountsIncludeQuotes() throws Exception {
		quoted(REG_A, 900);
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id,
					order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, '26102010999', '거래', ?, ?, 'QUOTEAPI01', 1000, 1, '2099-12-31', '2099-12-31', '구매요청')
				""", buyerId, sellerId, REG_A);
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/trades/pending-counts")
				.cookie(seller))
			.andExpect(jsonPath("$.data['" + REG_A + "']").value(2));
	}

	@Test
	@DisplayName("수락과 구매자 취소가 동시에 오면 교착·500 없이 정리된다 — 수량은 수락이 이긴 경우에만 묶인다(취소가 수락 뒤에 오면 둘 다 성공하고 풀린다)")
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

		// 수락된 견적은 구매자도 취소할 수 있어(2026-11-02) 수락이 먼저 끝나고 취소가 그 뒤에 실행되면 둘 다 성공한다 — 수량은 도로 풀린다.
		// 그 밖에는 하나만 성공하고, 진 쪽은 교착·500 이 아니라 409(이미 처리됨) 또는 404(취소로 행이 지워짐)
		if (accepted == 200 && canceled == 204) {
			assertThat(tradeCount()).isZero();
			assertThat(stockOf(REG_A)).isEqualTo(10);
			return;
		}
		assertThat((accepted == 200) ^ (canceled == 204)).isTrue();
		assertThat(accepted == 200 ? canceled : accepted).isIn(404, 409);
		// 수락이 이겼으면 수량이 묶이고(9), 취소가 이겼으면 그대로(10)
		assertThat(stockOf(REG_A)).isEqualTo(accepted == 200 ? 9 : 10);
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
