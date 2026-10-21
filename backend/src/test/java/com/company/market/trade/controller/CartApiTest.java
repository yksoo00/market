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

	private String items(String... regDates) {
		List<String> parts = new ArrayList<>();
		for (String reg : regDates) {
			parts.add("{\"sellerId\":\"%s\",\"regDate\":\"%s\"}".formatted(sellerId, reg));
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

	private String cartTradeId(UUID buyer, String regDate) {
		return jdbc.queryForObject("select trade_id from trd_trade_info where user_id = ? and reg_date = ? and trade_stats = '장바구니'",
				String.class, buyer, regDate);
	}

	@Test
	@DisplayName("여러 개 담기 → 합계 개수, 행은 구매검토/장바구니, 재고 그대로")
	void addSeveral() throws Exception {
		add(buyer, REG_A, REG_B).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(2));
		mvc.perform(get("/api/v1/cart/count").cookie(buyer)).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(2));
		var row = jdbc.queryForMap("select * from trd_trade_info where reg_date = ?", REG_A);
		assertThat(row.get("trade_type")).isEqualTo("구매검토");
		assertThat(row.get("trade_stats")).isEqualTo("장바구니");
		assertThat(row.get("order_unit_price")).isEqualTo(1000);
		assertThat(row.get("order_quantity")).isEqualTo(1);
		assertThat(jdbc.queryForObject("select stock_quantity from trd_prod_reg where reg_date = ?", Integer.class, REG_A))
			.isEqualTo(10);
	}

	@Test
	@DisplayName("이미 담긴 매물은 건너뜀 (성공)")
	void addTwiceSkips() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		add(buyer, REG_A, REG_A).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(1));
		assertThat(cartRows()).isEqualTo(1);
	}

	@Test
	@DisplayName("두 칸에서 동시에 같은 매물 담기 → 둘 다 성공, 행 1개")
	void concurrentAddSameListing() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<Integer>> results = new ArrayList<>();
		for (int i = 0; i < 2; i++) {
			results.add(pool.submit(() -> {
				start.await();
				return add(buyer, REG_A).andReturn().getResponse().getStatus();
			}));
		}
		start.countDown();
		for (Future<Integer> r : results) {
			assertThat(r.get()).isEqualTo(200);
		}
		pool.shutdown();
		assertThat(cartRows()).isEqualTo(1);
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
			jdbc.update("insert into trd_prod_master (prod_id, category_code, prod_name, prod_brand, reg_date) values (?, 'P01-Q01-R001', ?, 'Dell', ?)",
					prod, "상품" + i, reg);
			jdbc.update("insert into trd_prod_reg (user_id, reg_date, prod_id, trade_type, prod_state, sales_unit_price, sales_quantity, stock_quantity) values (?, ?, ?, '등록', '신품', 100, 1, 1)",
					sellerId, reg, prod);
			jdbc.update("insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, reg_date, prod_id, order_unit_price, order_quantity, trade_stats) values (?, ?, '구매검토', ?, ?, ?, 100, 1, '장바구니')",
					buyerId, "260920%05d".formatted(i), sellerId, reg, prod);
		}
		add(buyer, REG_A, REG_B).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CART_FULL"));
		assertThat(cartRows()).isEqualTo(99);
		add(buyer, REG_A).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(100));
		add(buyer, REG_A).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(100));
	}

	@Test
	@DisplayName("목록: 최신순, 지금 매물 값, 항목마다 tradeId")
	void listShowsCurrentListing() throws Exception {
		add(buyer, REG_A).andExpect(status().isOk());
		add(buyer, REG_B).andExpect(status().isOk());
		jdbc.update("update trd_prod_reg set sales_unit_price = 800 where reg_date = ?", REG_A);
		mvc.perform(get("/api/v1/cart").cookie(buyer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(2)))
			.andExpect(jsonPath("$.data.items[0].listing.regDate").value(REG_B))
			.andExpect(jsonPath("$.data.items[1].listing.regDate").value(REG_A))
			.andExpect(jsonPath("$.data.items[1].listing.salesUnitPrice").value(800))
			.andExpect(jsonPath("$.data.items[1].listing.prodName").value("서버 R740"))
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
