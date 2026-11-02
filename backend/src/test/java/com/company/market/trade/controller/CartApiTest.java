package com.company.market.trade.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 장바구니 API (스펙 2026-10-21-cart-design.md) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CartApiTest {

	static final String REG_A = "20261021100000";

	static final String REG_B = "20261021100001";

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
		sellerId = newUser("cartseller", "01033330001");
		buyerId = newUser("cartbuyer", "01033330002");
		seller = cookieOf(sellerId);
		buyer = cookieOf(buyerId);
		listing(REG_A, "CARTAPI001", "서버 R740", 1000, 10);
		listing(REG_B, "CARTAPI002", "스위치 C9300", 500, 100);
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
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
	}

	private void reviewRow(String tradeId, String stats) {
		jdbc.update("""
				insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id, order_unit_price,
					order_quantity, prov_date, req_deli_date, trade_stats)
				values (?, ?, '구매검토', ?, ?, 'CARTAPI01', 1000, 1, '2099-12-31', '2099-12-31', ?)
				""", buyerId, tradeId, sellerId, REG_A, stats);
	}

	@Test
	@DisplayName("DB: 같은 매물의 장바구니 행은 여러 줄이 되고(마이그레이션 2026-11-02), 비교용 행은 매물당 1줄만 된다")
	void cartRowsCanRepeatButCompareRowsCannot() {
		reviewRow("26110210001", "장바구니");
		reviewRow("26110210002", "장바구니");
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where trade_stats = '장바구니'", Integer.class)).isEqualTo(2);

		reviewRow("26110210003", "비교용");
		org.assertj.core.api.Assertions.assertThatThrownBy(() -> reviewRow("26110210004", "비교용"))
			.isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
	}

	private String item(String regDate, int quantity, String reqDeliDate, String remarks) {
		return "{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":%d,\"reqDeliDate\":\"%s\"%s}".formatted(sellerId, regDate,
				quantity, reqDeliDate, remarks == null ? "" : ",\"remarks\":\"" + remarks + "\"");
	}

	private ResultActions addItems(Cookie who, String... itemJson) throws Exception {
		return mvc.perform(post("/api/v1/cart").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[" + String.join(",", itemJson) + "]}"));
	}

	private String items(String... regDates) {
		List<String> parts = new ArrayList<>();
		for (String reg : regDates) {
			parts.add(item(reg, 1, "2099-12-31", null));
		}
		return "{\"items\":[" + String.join(",", parts) + "]}";
	}

	private ResultActions add(Cookie who, String... regDates) throws Exception {
		return mvc.perform(post("/api/v1/cart").cookie(who).contentType(MediaType.APPLICATION_JSON).content(items(regDates)));
	}

	private ResultActions remove(Cookie who, String... tradeIds) throws Exception {
		return mvc.perform(post("/api/v1/cart/remove").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"tradeIds\":[\"" + String.join("\",\"", tradeIds) + "\"]}"));
	}

	private int cartRows() {
		return jdbc.queryForObject("select count(*) from trd_trade_info where trade_stats = '장바구니'", Integer.class);
	}

	private int cartInfoRows(String type) {
		return jdbc.queryForObject("select count(*) from trd_cart_info where cart_type = ?", Integer.class, type);
	}

	private String cartTradeId(UUID buyer, String regDate) {
		return jdbc.queryForObject("select trade_id from trd_trade_info where user_id = ? and prod_reg_date = ? and trade_stats = '장바구니'",
				String.class, buyer, regDate);
	}

	@Test
	@DisplayName("담기: 거래 행(구매검토/장바구니, 입력값)과 장바구니 정보 행(같은 거래ID, ser_no 1·2, 매물·상품 값, 빈 사양 '')이 같이 생기고 재고는 그대로")
	void addStoresTradeAndCartRows() throws Exception {
		addItems(buyer, item(REG_A, 3, "2099-11-01", "빨리"), item(REG_B, 5, "2099-12-31", null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.count").value(2))
			.andExpect(jsonPath("$.data.added").value(2))
			.andExpect(jsonPath("$.data.skipped").value(0));
		var trade = jdbc.queryForMap("select * from trd_trade_info where prod_reg_date = ?", REG_A);
		assertThat(trade).containsEntry("trade_type", "구매검토").containsEntry("trade_stats", "장바구니")
			.containsEntry("order_unit_price", 1000).containsEntry("order_quantity", 3)
			.containsEntry("req_deli_date", "2099-11-01").containsEntry("remarks", "빨리");
		var cart = jdbc.queryForMap("select * from trd_cart_info where prod_date = ?", REG_A);
		assertThat(cart).containsEntry("user_id", buyerId).containsEntry("trade_id", trade.get("trade_id"))
			.containsEntry("cart_type", "장바구니").containsEntry("seller_id", sellerId).containsEntry("prod_no", "CARTAPI001")
			.containsEntry("prod_name", "서버 R740").containsEntry("manufacturer", "Dell").containsEntry("prod_spec_info", "")
			.containsEntry("prod_state", "신품").containsEntry("prov_date", "2099-12-31").containsEntry("order_unit_price", 1000)
			.containsEntry("order_quantity", 3).containsEntry("req_deli_date", "2099-11-01").containsEntry("remarks", "빨리");
		assertThat(cart.get("reg_date").toString()).hasSize(14);
		assertThat(jdbc.queryForList("select ser_no from trd_cart_info order by ser_no", Integer.class)).containsExactly(1, 2);
		assertThat(jdbc.queryForObject("select stock_quantity from trd_prod_reg where reg_date = ?", Integer.class, REG_A))
			.isEqualTo(10);
	}

	@Test
	@DisplayName("이미 담긴 매물을 다른 수량으로 다시 담으면 건너뛰고 처음 값 유지 — skipped 로 알린다")
	void addTwiceKeepsFirstValues() throws Exception {
		addItems(buyer, item(REG_A, 2, "2099-12-31", null)).andExpect(status().isOk());
		addItems(buyer, item(REG_A, 7, "2099-12-30", "다시")).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.count").value(1)).andExpect(jsonPath("$.data.added").value(0))
			.andExpect(jsonPath("$.data.skipped").value(1));
		assertThat(cartRows()).isEqualTo(1);
		assertThat(cartInfoRows("장바구니")).isEqualTo(1);
		assertThat(jdbc.queryForObject("select order_quantity from trd_cart_info", Integer.class)).isEqualTo(2);
	}

	@Test
	@DisplayName("한 요청에 같은 매물이 두 번이어도 한 번만 담는다")
	void sameListingTwiceInOneRequest() throws Exception {
		add(buyer, REG_A, REG_A).andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(1));
		assertThat(cartInfoRows("장바구니")).isEqualTo(1);
	}

	@Test
	@DisplayName("하나라도 틀리면(최소주문량 미달·주문단위 아님·지난 납품희망일·잘못된 날짜) 400 이고 두 테이블 모두 0행")
	void oneInvalidItemAddsNothing() throws Exception {
		jdbc.update("update trd_prod_reg set min_order_quantity = 2, order_unit = 2 where reg_date = ?", REG_B);
		addItems(buyer, item(REG_A, 1, "2099-12-31", null), item(REG_B, 1, "2099-12-31", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[1].orderQuantity']").isString());
		addItems(buyer, item(REG_B, 3, "2099-12-31", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[0].orderQuantity']").isString());
		addItems(buyer, item(REG_A, 1, "2020-01-01", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[0].reqDeliDate']").isString());
		addItems(buyer, item(REG_A, 1, "2099-02-31", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[0].reqDeliDate']").isString());
		assertThat(cartRows()).isZero();
		assertThat(cartInfoRows("장바구니")).isZero();
	}

	@Test
	@DisplayName("납품희망일이 비면 400, 요청사항 101자도 400")
	void deliveryDateRequired() throws Exception {
		addItems(buyer, item(REG_A, 1, "", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[0].reqDeliDate']").value("납품희망일을 입력해 주세요."));
		addItems(buyer, item(REG_A, 1, "2099-12-31", "가".repeat(101))).andExpect(status().isBadRequest());
		assertThat(cartRows()).isZero();
	}

	@Test
	@DisplayName("내 매물 403, 거래완료 409, 없는 매물이 섞이면 404 — 아무것도 안 담음")
	void blockedCases() throws Exception {
		add(seller, REG_A).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("TRADE_OWN_LISTING"));
		jdbc.update("update trd_prod_reg set stock_quantity = 0, dt_expire = '20261021100000' where reg_date = ?", REG_B);
		add(buyer, REG_A, REG_B).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LISTING_COMPLETED"));
		add(buyer, REG_A, "20991231000000").andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("LISTING_NOT_FOUND"));
		assertThat(cartRows()).isZero();
		assertThat(cartInfoRows("장바구니")).isZero();
	}

	@Test
	@DisplayName("한 번에 21개·0개는 400")
	void tooManyAtOnce() throws Exception {
		String[] many = new String[21];
		java.util.Arrays.fill(many, REG_A);
		add(buyer, many).andExpect(status().isBadRequest());
		add(buyer).andExpect(status().isBadRequest());
		assertThat(cartRows()).isZero();
	}

	@Test
	@DisplayName("합계 100개를 넘으면 409 CART_FULL — 이미 담긴 매물만 다시 담는 건 성공")
	void cartFull() throws Exception {
		for (int i = 0; i < 99; i++) {
			String reg = "2026102000%04d".formatted(i);
			String prod = "CARTFULL%02d".formatted(i);
			jdbc.update("insert into trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name, prod_brand, reg_date) values (?, 'P01', 'Q01', 'R001', ?, 'Dell', ?)",
					prod, "상품" + i, reg);
			jdbc.update("insert into trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price, sales_quantity, stock_quantity, prov_date) values (?, ?, ?, '등록', '신품', 100, 1, 1, '2099-12-31')",
					sellerId, reg, prod);
			jdbc.update("insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, prod_id, order_unit_price, order_quantity, prov_date, req_deli_date, trade_stats) values (?, ?, '구매검토', ?, ?, ?, 100, 1, '2099-12-31', '2099-12-31', '장바구니')",
					buyerId, "260920%05d".formatted(i), sellerId, reg, prod);
			jdbc.update("insert into trd_cart_info (user_id, trade_id, ser_no, cart_type, seller_id, prod_date, prod_name, prod_no, prod_spec_info, prod_state, prov_date, order_unit_price, order_quantity, req_deli_date, reg_date) values (?, ?, ?, '장바구니', ?, ?, ?, ?, '', '신품', '2099-12-31', 100, 1, '2099-12-31', '20261020000000')",
					buyerId, "260920%05d".formatted(i), i + 1, sellerId, reg, "상품" + i, prod);
		}
		add(buyer, REG_A, REG_B).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CART_FULL"));
		assertThat(cartRows()).isEqualTo(99);
		assertThat(cartInfoRows("장바구니")).isEqualTo(99);
		add(buyer, REG_A).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(100));
		add(buyer, REG_A).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(100));
	}

	@Test
	@DisplayName("목록: 최신순, 지금 매물 값, 항목마다 tradeId와 담을 때 입력(수량·납품희망일·요청사항)")
	void listShowsCurrentListing() throws Exception {
		addItems(buyer, item(REG_A, 4, "2099-11-11", "메모")).andExpect(status().isOk());
		add(buyer, REG_B).andExpect(status().isOk());
		jdbc.update("update trd_prod_reg set sales_unit_price = 800 where reg_date = ?", REG_A);
		mvc.perform(get("/api/v1/cart").cookie(buyer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(2)))
			.andExpect(jsonPath("$.data.items[0].listing.regDate").value(REG_B))
			.andExpect(jsonPath("$.data.items[1].listing.regDate").value(REG_A))
			.andExpect(jsonPath("$.data.items[1].listing.salesUnitPrice").value(800))
			.andExpect(jsonPath("$.data.items[1].listing.prodName").value("서버 R740"))
			.andExpect(jsonPath("$.data.items[1].orderQuantity").value(4))
			.andExpect(jsonPath("$.data.items[1].reqDeliDate").value("2099-11-11"))
			.andExpect(jsonPath("$.data.items[1].remarks").value("메모"))
			.andExpect(jsonPath("$.data.items[1].tradeId").value(cartTradeId(buyerId, REG_A)));
		// 남의 장바구니는 안 보인다
		mvc.perform(get("/api/v1/cart").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("담은 뒤 거래완료된 매물도 목록에 남고 tradeStatus=completed")
	void completedListingStays() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		jdbc.update("update trd_prod_reg set stock_quantity = 0, dt_expire = '20261021100000' where reg_date = ?", REG_A);
		mvc.perform(get("/api/v1/cart").cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].listing.tradeStatus").value("completed"));
	}

	@Test
	@DisplayName("빼기 → 204, 행 삭제")
	void removeRows() throws Exception {
		add(buyer, REG_A, REG_B).andExpect(status().isOk());
		remove(buyer, cartTradeId(buyerId, REG_A)).andExpect(status().isNoContent());
		assertThat(cartRows()).isEqualTo(1);
		assertThat(cartInfoRows("장바구니")).isEqualTo(1);
		mvc.perform(get("/api/v1/cart/count").cookie(buyer)).andExpect(jsonPath("$.data.count").value(1));
	}

	@Test
	@DisplayName("빼기에 남의 행이 섞이면 404 TRADE_NOT_FOUND — 내 행도 안 지움")
	void removeWithOthersRowRejectsAll() throws Exception {
		UUID otherId = newUser("cartother", "01033330003");
		add(buyer, REG_A).andExpect(status().isOk());
		add(cookieOf(otherId), REG_A).andExpect(status().isOk());
		remove(buyer, cartTradeId(buyerId, REG_A), cartTradeId(otherId, REG_A)).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("TRADE_NOT_FOUND"));
		assertThat(cartRows()).isEqualTo(2);
		assertThat(cartInfoRows("장바구니")).isEqualTo(2);
	}

	private ResultActions buy(String regDate, int quantity) throws Exception {
		return mvc.perform(post("/api/v1/trades").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":%d,\"reqDeliDate\":\"2099-12-31\"}".formatted(sellerId, regDate, quantity)));
	}

	private ResultActions quote(String regDate, int price) throws Exception {
		return mvc.perform(post("/api/v1/trades/quotes").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderUnitPrice\":%d,\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}]}"
				.formatted(sellerId, regDate, price)));
	}

	@Test
	@DisplayName("구매하면 그 매물이 장바구니에서 빠지고 내 구매목록에 구매요청")
	void purchaseRemovesFromCart() throws Exception {
		add(buyer, REG_A, REG_B).andExpect(status().isOk());
		buy(REG_A, 2).andExpect(status().isCreated());
		assertThat(cartRows()).isEqualTo(1);
		mvc.perform(get("/api/v1/trades").param("role", "buyer").cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].tradeStats").value("requested"));
	}

	@Test
	@DisplayName("구매가 실패(재고 부족 409)하면 장바구니 행이 남는다")
	void failedPurchaseKeepsCart() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		buy(REG_A, 11).andExpect(status().is4xxClientError());
		assertThat(cartRows()).isEqualTo(1);
	}

	@Test
	@DisplayName("견적 요청하면 그 매물만 장바구니에서 빠진다, 실패(희망단가 초과 400)면 남는다")
	void quoteRemovesFromCart() throws Exception {
		add(buyer, REG_A, REG_B).andExpect(status().isOk());
		quote(REG_B, 501).andExpect(status().isBadRequest());
		assertThat(cartRows()).isEqualTo(2);
		quote(REG_A, 900).andExpect(status().isCreated());
		assertThat(cartRows()).isEqualTo(1);
		assertThat(cartTradeId(buyerId, REG_B)).isNotNull();
	}

	@Test
	@DisplayName("수락된 견적에서 구매해도 그 매물이 장바구니에서 빠진다")
	void purchaseFromQuoteRemovesFromCart() throws Exception {
		quote(REG_A, 900).andExpect(status().isCreated());
		String quoteId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '견적조정'", String.class);
		mvc.perform(post("/api/v1/trades/" + quoteId + "/accept").cookie(seller)).andExpect(status().isOk());
		add(buyer, REG_A).andExpect(status().isOk());
		mvc.perform(post("/api/v1/trades/" + quoteId + "/purchase").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}")).andExpect(status().isOk());
		assertThat(cartRows()).isZero();
	}

	@Test
	@DisplayName("담긴 매물을 구매하면 새 행을 만들지 않고 그 행이 구매요청이 된다 — 같은 거래ID, 장바구니 정보 행은 삭제")
	void purchaseConvertsCartRow() throws Exception {
		addItems(buyer, item(REG_A, 2, "2099-11-01", "담을 때")).andExpect(status().isOk());
		String id = cartTradeId(buyerId, REG_A);
		buy(REG_A, 3).andExpect(status().isCreated());
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", id);
		assertThat(row).containsEntry("trade_type", "거래").containsEntry("trade_stats", "구매요청")
			.containsEntry("order_quantity", 3).containsEntry("req_deli_date", "2099-12-31");
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info", Integer.class)).isZero();
		assertThat(jdbc.queryForObject("select stock_quantity from trd_prod_reg where reg_date = ?", Integer.class, REG_A)).isEqualTo(7);
	}

	@Test
	@DisplayName("담지 않은 매물 구매는 지금처럼 새 행")
	void purchaseWithoutCartRowCreatesNewRow() throws Exception {
		buy(REG_A, 1).andExpect(status().isCreated());
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info", Integer.class)).isZero();
	}

	@Test
	@DisplayName("담긴 매물을 견적 요청하면 그 행이 견적요청이 된다 — 같은 거래ID")
	void quoteConvertsCartRow() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		String id = cartTradeId(buyerId, REG_A);
		quote(REG_A, 900).andExpect(status().isCreated());
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", id);
		assertThat(row).containsEntry("trade_type", "견적조정").containsEntry("trade_stats", "견적요청").containsEntry("order_unit_price", 900);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info", Integer.class)).isZero();
	}

	@Test
	@DisplayName("같은 매물의 견적 행이 이미 있으면 그 행을 덮어쓰고 장바구니 두 행만 지운다")
	void quoteWithExistingQuoteDeletesCartRowsOnly() throws Exception {
		quote(REG_A, 900).andExpect(status().isCreated());
		String quoteId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '견적조정'", String.class);
		add(buyer, REG_A).andExpect(status().isOk());
		quote(REG_A, 800).andExpect(status().isCreated());
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select order_unit_price from trd_trade_info where trade_id = ?", Integer.class, quoteId)).isEqualTo(800);
		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info", Integer.class)).isZero();
	}

	@Test
	@DisplayName("구매·견적을 해도 같은 매물의 비교 행(두 테이블)은 그대로")
	void compareRowSurvivesPurchaseAndQuote() throws Exception {
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/cart/compare").cookie(buyer)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\"},{\"sellerId\":\"%s\",\"regDate\":\"%s\"}]}"
				.formatted(sellerId, REG_A, sellerId, REG_B)))
			.andExpect(status().isOk());
		buy(REG_A, 1).andExpect(status().isCreated());
		quote(REG_B, 400).andExpect(status().isCreated());
		assertThat(cartInfoRows("비교용")).isEqualTo(2);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where trade_stats = '비교용'", Integer.class)).isEqualTo(2);
	}

	@Test
	@DisplayName("매물 상품을 바꾸면 거래 행과 장바구니 정보 행의 상품 번호가 새 값 — 목록이 계속 그 행을 찾는다")
	void productChangeFollowsCartInfo() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
			.patch("/api/v1/listings/" + sellerId + "/" + REG_A).cookie(seller).contentType(MediaType.APPLICATION_JSON)
			.content("{\"prodName\":\"완전 새 상품\"}")).andExpect(status().isOk());
		String newProdId = jdbc.queryForObject("select prod_id from trd_prod_reg where reg_date = ?", String.class, REG_A);
		assertThat(newProdId).isNotEqualTo("CARTAPI001");
		assertThat(jdbc.queryForObject("select prod_no from trd_cart_info", String.class)).isEqualTo(newProdId);
		assertThat(jdbc.queryForObject("select prod_id from trd_trade_info where trade_stats = '장바구니'", String.class)).isEqualTo(newProdId);
		mvc.perform(get("/api/v1/cart").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(1)));
	}

	@Test
	@DisplayName("매물을 지우면 그 매물의 장바구니·비교 행도 두 테이블에서 지워진다")
	void listingDeleteRemovesCartRows() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/cart/compare").cookie(buyer)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\"},{\"sellerId\":\"%s\",\"regDate\":\"%s\"}]}".formatted(sellerId, REG_A, sellerId, REG_B)))
			.andExpect(status().isOk());
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
			.delete("/api/v1/listings/" + sellerId + "/" + REG_A).cookie(seller)).andExpect(status().isNoContent());
		assertThat(cartRows()).isZero();
		assertThat(cartInfoRows("장바구니")).isZero();
		assertThat(cartInfoRows("비교용")).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where trade_stats = '비교용'", Integer.class)).isEqualTo(1);
	}

	@Test
	@DisplayName("장바구니 행은 판매자 목록·pendingCounts·내 구매목록에 안 보인다")
	void cartHiddenFromTradeLists() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		mvc.perform(get("/api/v1/trades").param("role", "seller").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(0)));
		mvc.perform(get("/api/v1/trades/pending-counts").cookie(seller)).andExpect(jsonPath("$.data." + REG_A).doesNotExist());
		mvc.perform(get("/api/v1/trades").param("role", "buyer").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("장바구니 tradeId 로 거래 동작(취소·완료·수락·견적구매)을 불러도 행이 안 바뀐다")
	void cartRowIgnoresTradeActions() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		String id = cartTradeId(buyerId, REG_A);
		mvc.perform(post("/api/v1/trades/" + id + "/cancel").cookie(buyer)).andExpect(status().is4xxClientError());
		mvc.perform(post("/api/v1/trades/" + id + "/complete").cookie(buyer)).andExpect(status().is4xxClientError());
		mvc.perform(post("/api/v1/trades/" + id + "/accept").cookie(seller)).andExpect(status().is4xxClientError());
		mvc.perform(post("/api/v1/trades/" + id + "/purchase").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"orderQuantity\":1}")).andExpect(status().is4xxClientError());
		assertThat(cartRows()).isEqualTo(1);
	}

	@Test
	@DisplayName("로그인 안 하면 401")
	void requiresLogin() throws Exception {
		mvc.perform(post("/api/v1/cart").contentType(MediaType.APPLICATION_JSON).content(items(REG_A)))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/cart")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/cart/count")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/cart/remove").contentType(MediaType.APPLICATION_JSON).content("{\"tradeIds\":[\"x\"]}"))
			.andExpect(status().isUnauthorized());
	}

}
