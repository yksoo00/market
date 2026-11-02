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
	com.company.market.trade.service.CartService carts;

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
	@DisplayName("담기: 거래 행(구매검토/장바구니, 입력값)과 장바구니 정보 행(같은 거래ID, ser_no 1·2, 매물·상품 값, 빈 사양 '')이 같이 생기고 담은 수량만큼 재고가 묶인다")
	void addStoresTradeAndCartRows() throws Exception {
		addItems(buyer, item(REG_A, 3, "2099-11-01", "빨리"), item(REG_B, 5, "2099-12-31", null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.count").value(2))
			.andExpect(jsonPath("$.data.added").value(2));
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
		// 담으면 그 수량만큼 재고가 묶인다 (2026-11-02)
		assertThat(stockOf(REG_A)).isEqualTo(7);
		assertThat(stockOf(REG_B)).isEqualTo(95);
	}

	@Test
	@DisplayName("같은 매물을 또 담으면 합치지도 바꾸지도 않고 새 줄(새 거래) — 줄마다 자기 수량을 묶는다 (2026-11-02)")
	void addTwiceCreatesSeparateRows() throws Exception {
		addItems(buyer, item(REG_A, 2, "2099-12-31", null)).andExpect(status().isOk());
		addItems(buyer, item(REG_A, 2, "2099-12-31", null)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.count").value(2)).andExpect(jsonPath("$.data.added").value(1));
		addItems(buyer, item(REG_A, 5, "2099-12-30", "다시")).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.count").value(3));
		assertThat(cartRows()).isEqualTo(3);
		assertThat(cartInfoRows("장바구니")).isEqualTo(3);
		assertThat(jdbc.queryForList("select order_quantity from trd_cart_info order by order_quantity", Integer.class)).containsExactly(2, 2, 5);
		assertThat(stockOf(REG_A)).isEqualTo(1);
	}

	@Test
	@DisplayName("한 요청에 같은 매물이 두 번이면 두 줄 — 차례로 묶는다")
	void sameListingTwiceInOneRequest() throws Exception {
		add(buyer, REG_A, REG_A).andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(2));
		assertThat(cartInfoRows("장바구니")).isEqualTo(2);
		assertThat(stockOf(REG_A)).isEqualTo(8);
	}

	@Test
	@DisplayName("재고보다 많이 담으면 400 — 틀린 줄의 수량 칸에만 오류(items[i].orderQuantity), 아무것도 안 담고 재고 그대로")
	void addOverStockFailsOnThatItem() throws Exception {
		addItems(buyer, item(REG_B, 1, "2099-12-31", null), item(REG_A, 11, "2099-12-31", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[1].orderQuantity']").value("현재 재고(10)보다 많이 담을 수 없습니다."))
			.andExpect(jsonPath("$.fields['items[0].orderQuantity']").doesNotExist());
		assertThat(cartRows()).isZero();
		assertThat(stockOf(REG_A)).isEqualTo(10);
		assertThat(stockOf(REG_B)).isEqualTo(100);
	}

	@Test
	@DisplayName("같은 요청의 같은 매물 합계가 재고를 넘으면(6+6 > 10) 뒤 줄이 실패하고 먼저 묶은 것까지 전부 되돌린다")
	void addTotalOverStockRollsBack() throws Exception {
		addItems(buyer, item(REG_A, 6, "2099-12-31", null), item(REG_A, 6, "2099-12-31", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['items[1].orderQuantity']").exists());
		assertThat(cartRows()).isZero();
		assertThat(stockOf(REG_A)).isEqualTo(10);
	}

	@Test
	@DisplayName("두 구매자가 동시에 마지막 1개를 담으면 한 명만 담긴다 — 다른 쪽은 400 재고 부족, 재고는 음수가 안 된다")
	void concurrentLastUnit() throws Exception {
		jdbc.update("update trd_prod_reg set stock_quantity = 1 where reg_date = ?", REG_A);
		UUID otherId = newUser("cartother2", "01033330033");
		Cookie other = cookieOf(otherId);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<Integer>> results = new ArrayList<>();
		for (Cookie who : List.of(buyer, other)) {
			results.add(pool.submit(() -> {
				start.await();
				return add(who, REG_A).andReturn().getResponse().getStatus();
			}));
		}
		start.countDown();
		List<Integer> codes = new ArrayList<>();
		for (Future<Integer> r : results) {
			codes.add(r.get());
		}
		pool.shutdown();
		assertThat(codes).containsExactlyInAnyOrder(200, 400);
		assertThat(cartRows()).isEqualTo(1);
		assertThat(stockOf(REG_A)).isZero();
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
	@DisplayName("합계 100줄을 넘으면 409 CART_FULL — 같은 매물도 새 줄이라 100번째까지만")
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
		add(buyer, REG_A).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CART_FULL"));
		assertThat(cartRows()).isEqualTo(100);
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
	@DisplayName("같은 매물이 여러 줄이어도 목록은 줄마다 나온다 — 줄의 tradeId·수량이 각자, 매물 값은 같다")
	void listShowsEveryRowOfTheSameListing() throws Exception {
		addItems(buyer, item(REG_A, 2, "2099-12-31", null), item(REG_A, 3, "2099-11-30", "두 번째")).andExpect(status().isOk());
		mvc.perform(get("/api/v1/cart").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(2)))
			.andExpect(jsonPath("$.data.items[0].orderQuantity").value(3))
			.andExpect(jsonPath("$.data.items[0].addedAt").isString())
			.andExpect(jsonPath("$.data.items[1].orderQuantity").value(2))
			.andExpect(jsonPath("$.data.items[0].tradeId").isNotEmpty())
			.andExpect(jsonPath("$.data.items[0].listing.regDate").value(REG_A))
			.andExpect(jsonPath("$.data.items[1].listing.regDate").value(REG_A));
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
	@DisplayName("빼면 그 줄이 묶었던 수량이 풀린다 — 다른 줄은 그대로 묶여 있다")
	void removeReleasesHeldQuantity() throws Exception {
		addItems(buyer, item(REG_A, 3, "2099-12-31", null), item(REG_A, 2, "2099-12-31", null)).andExpect(status().isOk());
		assertThat(stockOf(REG_A)).isEqualTo(5);
		String three = jdbc.queryForObject("select trade_id from trd_trade_info where order_quantity = 3", String.class);
		remove(buyer, three).andExpect(status().isNoContent());
		assertThat(stockOf(REG_A)).isEqualTo(8);
		assertThat(cartRows()).isEqualTo(1);
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
		return buy(regDate, quantity, null);
	}

	/** cartTradeId 가 있으면 장바구니의 그 줄이 구매요청이 된다 */
	private ResultActions buy(String regDate, int quantity, String cartTradeId) throws Exception {
		return mvc.perform(post("/api/v1/trades").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":%d,\"reqDeliDate\":\"2099-12-31\"%s}".formatted(sellerId, regDate, quantity,
					cartTradeId == null ? "" : ",\"cartTradeId\":\"" + cartTradeId + "\"")));
	}

	private int stockOf(String regDate) {
		return jdbc.queryForObject("select stock_quantity from trd_prod_reg where reg_date = ?", Integer.class, regDate);
	}

	private ResultActions quote(String regDate, int price) throws Exception {
		return quote(regDate, price, null);
	}

	/** cartTradeId 가 있으면 장바구니의 그 줄이 견적요청이 된다 */
	private ResultActions quote(String regDate, int price, String cartTradeId) throws Exception {
		return mvc.perform(post("/api/v1/trades/quotes").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderUnitPrice\":%d,\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"%s}]}"
				.formatted(sellerId, regDate, price, cartTradeId == null ? "" : ",\"cartTradeId\":\"" + cartTradeId + "\"")));
	}

	@Test
	@DisplayName("직접 구매(장바구니 줄을 안 가리킴)는 장바구니 줄을 건드리지 않고 새 구매요청을 만든다")
	void directPurchaseLeavesCartAlone() throws Exception {
		add(buyer, REG_A, REG_B).andExpect(status().isOk());
		buy(REG_A, 2).andExpect(status().isCreated());
		assertThat(cartRows()).isEqualTo(2);
		assertThat(stockOf(REG_A)).isEqualTo(7);
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
	@DisplayName("장바구니 줄에서 견적 요청하면 그 줄이 견적요청이 되고 묶었던 수량이 풀린다 (견적은 안 묶는다). 실패(희망단가 초과 400)면 줄·수량 그대로")
	void quoteFromCartRow() throws Exception {
		addItems(buyer, item(REG_A, 3, "2099-12-31", null), item(REG_B, 4, "2099-12-31", null)).andExpect(status().isOk());
		String a = cartTradeId(buyerId, REG_A);
		quote(REG_B, 501, cartTradeId(buyerId, REG_B)).andExpect(status().isBadRequest());
		assertThat(cartRows()).isEqualTo(2);
		assertThat(stockOf(REG_B)).isEqualTo(96);

		quote(REG_A, 900, a).andExpect(status().isCreated());
		assertThat(cartRows()).isEqualTo(1);
		assertThat(cartTradeId(buyerId, REG_B)).isNotNull();
		// 견적은 수량을 안 묶는다 — 줄이 묶었던 3개가 돌아온다
		assertThat(stockOf(REG_A)).isEqualTo(10);
	}

	@Test
	@DisplayName("직접 견적(장바구니 줄을 안 가리킴)은 장바구니 줄을 건드리지 않는다")
	void directQuoteLeavesCartAlone() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		quote(REG_A, 900).andExpect(status().isCreated());
		assertThat(cartRows()).isEqualTo(1);
		assertThat(stockOf(REG_A)).isEqualTo(9);
	}

	@Test
	@DisplayName("남의 장바구니 줄이나 다른 매물의 줄을 가리키면 404 — 구매·견적 모두, 아무것도 안 바뀐다")
	void cartTradeIdMustBeMineAndMatchListing() throws Exception {
		UUID otherId = newUser("cartother3", "01033330044");
		add(cookieOf(otherId), REG_A).andExpect(status().isOk());
		String othersRow = cartTradeId(otherId, REG_A);
		add(buyer, REG_B).andExpect(status().isOk());
		String myRowOfB = cartTradeId(buyerId, REG_B);
		buy(REG_A, 1, othersRow).andExpect(status().isNotFound());
		buy(REG_A, 1, myRowOfB).andExpect(status().isNotFound());
		quote(REG_A, 900, othersRow).andExpect(status().isNotFound());
		assertThat(cartRows()).isEqualTo(2);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where trade_type <> '구매검토'", Integer.class)).isZero();
	}

	@Test
	@DisplayName("수락된 견적에서 구매해도 장바구니 줄은 그대로 — 장바구니와 견적은 따로다")
	void purchaseFromQuoteLeavesCartAlone() throws Exception {
		quote(REG_A, 900).andExpect(status().isCreated());
		String quoteId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '견적조정'", String.class);
		mvc.perform(post("/api/v1/trades/" + quoteId + "/accept").cookie(seller)).andExpect(status().isOk());
		add(buyer, REG_A).andExpect(status().isOk());
		mvc.perform(post("/api/v1/trades/" + quoteId + "/purchase").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}")).andExpect(status().isOk());
		assertThat(cartRows()).isEqualTo(1);
		// 견적 1개(수락 때 묶음) + 장바구니 1개
		assertThat(stockOf(REG_A)).isEqualTo(8);
	}

	@Test
	@DisplayName("장바구니 줄(cartTradeId)에서 구매하면 새 행을 만들지 않고 그 행이 구매요청이 된다 — 같은 거래ID, 장바구니 정보 행은 삭제, 묶은 수량은 요청 수량으로 바뀐다")
	void purchaseConvertsCartRow() throws Exception {
		addItems(buyer, item(REG_A, 2, "2099-11-01", "담을 때")).andExpect(status().isOk());
		String id = cartTradeId(buyerId, REG_A);
		assertThat(stockOf(REG_A)).isEqualTo(8);
		buy(REG_A, 3, id).andExpect(status().isCreated());
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", id);
		assertThat(row).containsEntry("trade_type", "거래").containsEntry("trade_stats", "구매요청")
			.containsEntry("order_quantity", 3).containsEntry("req_deli_date", "2099-12-31");
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info", Integer.class)).isZero();
		// 담을 때 묶은 2개를 풀고 요청 수량 3개를 묶었다
		assertThat(stockOf(REG_A)).isEqualTo(7);
	}

	@Test
	@DisplayName("그 줄이 묶은 수량도 쓸 수 있다 — 재고 10 에서 10개 담은 줄로 10개 구매 가능(남의 몫만 빼고 센다)")
	void purchaseFromCartRowCanUseItsOwnHeldQuantity() throws Exception {
		addItems(buyer, item(REG_A, 10, "2099-12-31", null)).andExpect(status().isOk());
		assertThat(stockOf(REG_A)).isZero();
		buy(REG_A, 10, cartTradeId(buyerId, REG_A)).andExpect(status().isCreated());
		assertThat(stockOf(REG_A)).isZero();
		buy(REG_A, 1).andExpect(status().is4xxClientError());
	}

	@Test
	@DisplayName("담지 않은 매물 구매는 지금처럼 새 행")
	void purchaseWithoutCartRowCreatesNewRow() throws Exception {
		buy(REG_A, 1).andExpect(status().isCreated());
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info", Integer.class)).isZero();
	}

	@Test
	@DisplayName("장바구니 줄에서 견적 요청하면 그 행이 견적요청이 된다 — 같은 거래ID, 묶은 수량은 풀린다")
	void quoteConvertsCartRow() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		String id = cartTradeId(buyerId, REG_A);
		quote(REG_A, 900, id).andExpect(status().isCreated());
		var row = jdbc.queryForMap("select * from trd_trade_info where trade_id = ?", id);
		assertThat(row).containsEntry("trade_type", "견적조정").containsEntry("trade_stats", "견적요청").containsEntry("order_unit_price", 900);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info", Integer.class)).isZero();
		assertThat(stockOf(REG_A)).isEqualTo(10);
	}

	@Test
	@DisplayName("이미 견적 행이 있는데 장바구니 줄에서 견적을 보내면 그 견적 행을 덮어쓰고 그 장바구니 줄만 지운다(수량 풀림). 줄을 안 가리키면 장바구니는 그대로")
	void quoteWithExistingQuoteDeletesThatCartRowOnly() throws Exception {
		quote(REG_A, 900).andExpect(status().isCreated());
		String quoteId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '견적조정'", String.class);
		addItems(buyer, item(REG_A, 2, "2099-12-31", null), item(REG_A, 3, "2099-12-31", null)).andExpect(status().isOk());
		assertThat(stockOf(REG_A)).isEqualTo(5);
		String two = jdbc.queryForObject("select trade_id from trd_trade_info where order_quantity = 2 and trade_stats = '장바구니'", String.class);

		quote(REG_A, 800, two).andExpect(status().isCreated());
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where trade_type = '견적조정'", Integer.class)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select order_unit_price from trd_trade_info where trade_id = ?", Integer.class, quoteId)).isEqualTo(800);
		assertThat(cartRows()).isEqualTo(1);
		assertThat(stockOf(REG_A)).isEqualTo(7);
	}

	@Test
	@DisplayName("수락된 견적을 다시 요청하면 수락 때 묶은 수량이 풀린다")
	void requoteOfAcceptedQuoteReleasesHeldQuantity() throws Exception {
		quote(REG_A, 900).andExpect(status().isCreated());
		String quoteId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '견적조정'", String.class);
		mvc.perform(post("/api/v1/trades/" + quoteId + "/accept").cookie(seller)).andExpect(status().isOk());
		assertThat(stockOf(REG_A)).isEqualTo(9);
		quote(REG_A, 800).andExpect(status().isCreated());
		assertThat(stockOf(REG_A)).isEqualTo(10);
	}

	@Test
	@DisplayName("1시간이 지난 장바구니 줄은 자동으로 지워지고 묶인 수량이 풀린다 — 한 번만(두 번 불러도), 새 줄·전환된 줄은 건드리지 않는다")
	void expireReleasesStaleRows() throws Exception {
		addItems(buyer, item(REG_A, 3, "2099-12-31", null), item(REG_A, 2, "2099-12-31", null), item(REG_B, 4, "2099-12-31", null)).andExpect(status().isOk());
		String old = jdbc.queryForObject("select trade_id from trd_trade_info where order_quantity = 3", String.class);
		String converted = jdbc.queryForObject("select trade_id from trd_trade_info where order_quantity = 4", String.class);
		String fresh = jdbc.queryForObject("select trade_id from trd_trade_info where order_quantity = 2", String.class);
		String twoHoursAgo = java.time.LocalDateTime.now(java.time.ZoneOffset.UTC).minusHours(2).format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
		jdbc.update("update trd_trade_info set reg_date = ? where trade_id in (?, ?)", twoHoursAgo, old, converted);
		jdbc.update("update trd_cart_info set reg_date = ? where trade_id in (?, ?)", twoHoursAgo, old, converted);
		// 만료 전에 구매로 바뀐 줄은 장바구니가 아니므로 지우지 않는다
		buy(REG_B, 4, converted).andExpect(status().isCreated());

		assertThat(carts.staleTradeIds()).containsExactly(old);
		assertThat(carts.expire(old)).isTrue();
		assertThat(carts.expire(old)).isFalse();
		assertThat(carts.expire(fresh)).isFalse();
		assertThat(carts.expire(converted)).isFalse();
		assertThat(stockOf(REG_A)).isEqualTo(8);
		assertThat(stockOf(REG_B)).isEqualTo(96);
		assertThat(cartRows()).isEqualTo(1);
		assertThat(cartInfoRows("장바구니")).isEqualTo(1);
		assertThat(carts.staleTradeIds()).isEmpty();
	}

	@Test
	@DisplayName("가리키는 매물이 없어진 오래된 줄도 자동 삭제가 줄을 지운다 — 풀 재고가 없어 롤백으로 영영 안 지워지는 일이 없다")
	void expireRemovesRowOfMissingListing() throws Exception {
		add(buyer, REG_B).andExpect(status().isOk());
		String id = cartTradeId(buyerId, REG_B);
		String twoHoursAgo = java.time.LocalDateTime.now(java.time.ZoneOffset.UTC).minusHours(2).format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
		jdbc.update("update trd_trade_info set reg_date = ? where trade_id = ?", twoHoursAgo, id);
		jdbc.update("delete from trd_prod_reg where reg_date = ?", REG_B);
		assertThat(carts.expire(id)).isTrue();
		assertThat(cartRows()).isZero();
		assertThat(cartInfoRows("장바구니")).isZero();
	}

	@Test
	@DisplayName("장바구니가 묶은 수량이 남아 있으면 마지막 구매가 확정돼도 판매완료가 아니다 — 줄을 빼 수량이 돌아오면 계속 거래 중")
	void cartHoldPreventsSoldOutAtConfirmation() throws Exception {
		jdbc.update("update trd_prod_reg set stock_quantity = 2, sales_quantity = 2 where reg_date = ?", REG_A);
		UUID otherId = newUser("cartother4", "01033330055");
		Cookie other = cookieOf(otherId);
		add(buyer, REG_A).andExpect(status().isOk());
		mvc.perform(post("/api/v1/trades").cookie(other).contentType(MediaType.APPLICATION_JSON)
			.content("{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}".formatted(sellerId, REG_A)))
			.andExpect(status().isCreated());
		assertThat(stockOf(REG_A)).isZero();
		String tradeId = jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '거래'", String.class);
		mvc.perform(post("/api/v1/trades/" + tradeId + "/complete").cookie(other)).andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select dt_expire from trd_prod_reg where reg_date = ?", String.class, REG_A)).isNull();

		remove(buyer, cartTradeId(buyerId, REG_A)).andExpect(status().isNoContent());
		assertThat(stockOf(REG_A)).isEqualTo(1);
		assertThat(jdbc.queryForObject("select dt_expire from trd_prod_reg where reg_date = ?", String.class, REG_A)).isNull();
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
