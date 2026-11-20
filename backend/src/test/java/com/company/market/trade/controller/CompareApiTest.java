package com.company.market.trade.controller;

import java.util.ArrayList;
import java.util.List;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 비교 (설계 2026-10-27 PR 3, 사용자 결정 2026-10-29·2026-11-03): 담기는 쌓이고, 교체·비우기만 지운다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CompareApiTest {

	static final String[] REGS = { "20261029100000", "20261029100001", "20261029100002", "20261029100003", "20261029100004",
			"20261029100005" };

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

	Cookie seller;

	Cookie buyer;

	/** REGS[0..4] 는 같은 소분류 R001 (4 는 거래완료), REGS[5] 는 R002 */
	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = newUser("cmpseller", "01044440001");
		buyerId = newUser("cmpbuyer", "01044440002");
		seller = cookieOf(sellerId);
		buyer = cookieOf(buyerId);
		for (int i = 0; i < REGS.length; i++) {
			listing(REGS[i], "CMPAPI00" + i, "상품 " + i, i == 5 ? "R002" : "R001", i == 4 ? 0 : 10);
		}
		// REGS[3] 은 최소주문량 3 — 비교 행의 수량 기본값 확인용
		jdbc.update("update trd_prod_reg set min_order_quantity = 3 where reg_date = ?", REGS[3]);
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

	private Cookie cookieOf(String id) {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(id));
	}

	private void listing(String regDate, String prodId, String name, String minor, int stock) {
		productRepository.saveAndFlush(Product.builder().prodId(prodId).majorCategory("P01").middleCategory("Q01")
			.minorCategory(minor).prodName(name).prodBrand("Dell").regDate(regDate).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(regDate).prodId(prodId)
			.tradeType("등록").prodState("신품").salesUnitPrice(1000).salesQuantity(10).stockQuantity(stock)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
		if (stock == 0) {
			jdbc.update("update trd_prod_reg set dt_expire = '20261029100000' where reg_date = ?", regDate);
		}
	}

	private ResultActions compare(Cookie who, int... indexes) throws Exception {
		List<String> parts = new ArrayList<>();
		for (int i : indexes) {
			parts.add("{\"sellerId\":\"%s\",\"regDate\":\"%s\"}".formatted(sellerId, REGS[i]));
		}
		return mvc.perform(put("/api/v1/cart/compare").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[" + String.join(",", parts) + "]}"));
	}

	private ResultActions addCompare(Cookie who, int... indexes) throws Exception {
		List<String> parts = new ArrayList<>();
		for (int i : indexes) {
			parts.add("{\"sellerId\":\"%s\",\"regDate\":\"%s\"}".formatted(sellerId, REGS[i]));
		}
		return mvc.perform(post("/api/v1/cart/compare").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[" + String.join(",", parts) + "]}"));
	}

	private List<String> compareProdDates() {
		return jdbc.queryForList("select prod_date from trd_cart_info where cart_type = '비교용' order by prod_date", String.class);
	}

	private int compareTradeRows() {
		return jdbc.queryForObject("select count(*) from trd_trade_info where trade_stats = '비교용'", Integer.class);
	}

	@Test
	@DisplayName("같은 소분류 2개를 비교하면 두 테이블에 비교용 행 — 수량은 최소주문량, 납품희망일은 제공가능일, 장바구니 개수에는 안 센다")
	void replaceStoresCompareRows() throws Exception {
		compare(buyer, 0, 3).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(2));
		assertThat(compareTradeRows()).isEqualTo(2);
		var cart = jdbc.queryForMap("select * from trd_cart_info where prod_date = ?", REGS[3]);
		assertThat(cart).containsEntry("cart_type", "비교용").containsEntry("order_quantity", 3)
			.containsEntry("req_deli_date", "2099-12-31").containsEntry("prov_date", "2099-12-31")
			.containsEntry("order_unit_price", 1000);
		assertThat(cart.get("remarks")).isNull();
		var trade = jdbc.queryForMap("select * from trd_trade_info where prod_reg_date = ?", REGS[3]);
		assertThat(trade).containsEntry("trade_type", "구매검토").containsEntry("trade_stats", "비교용");
		mvc.perform(get("/api/v1/cart/count").cookie(buyer)).andExpect(jsonPath("$.data.count").value(0));
		mvc.perform(get("/api/v1/cart").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("다시 비교하면 이전 비교 목록은 지워지고 이번 선택만 남는다 — 같은 매물을 다시 보내도 오류 없음")
	void replaceDropsPreviousList() throws Exception {
		compare(buyer, 0, 1, 2).andExpect(status().isOk());
		compare(buyer, 3, 4).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(2));
		assertThat(compareProdDates()).containsExactly(REGS[3], REGS[4]);
		assertThat(compareTradeRows()).isEqualTo(2);
		compare(buyer, 3, 4).andExpect(status().isOk());
		assertThat(compareProdDates()).containsExactly(REGS[3], REGS[4]);
		assertThat(compareTradeRows()).isEqualTo(2);
	}

	@Test
	@DisplayName("교체는 1~4개 OK, 5개는 400 COMPARE_COUNT, 소분류가 섞이면 400 COMPARE_CATEGORY_MISMATCH")
	void compareRules() throws Exception {
		compare(buyer, 0).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(1));
		compare(buyer, 0, 1, 2, 3, 4).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMPARE_COUNT"));
		compare(buyer, 0, 5).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMPARE_CATEGORY_MISMATCH"));
		compare(buyer, 0, 1, 2, 3).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(4));
	}

	@Test
	@DisplayName("틀린 요청(개수·소분류·내 매물·없는 매물)이면 이전 비교 목록이 그대로 — 두 테이블 모두")
	void failedCompareKeepsPreviousList() throws Exception {
		compare(buyer, 0, 1).andExpect(status().isOk());
		compare(buyer, 0, 1, 2, 3, 4).andExpect(status().isBadRequest());
		compare(buyer, 2, 5).andExpect(status().isBadRequest());
		compare(seller, 0, 1).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("TRADE_OWN_LISTING"));
		mvc.perform(put("/api/v1/cart/compare").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\"},{\"sellerId\":\"%s\",\"regDate\":\"20991231000000\"}]}"
				.formatted(sellerId, REGS[2], sellerId)))
			.andExpect(status().isNotFound());
		assertThat(compareProdDates()).containsExactly(REGS[0], REGS[1]);
		assertThat(compareTradeRows()).isEqualTo(2);
	}

	@Test
	@DisplayName("담기는 기존 목록에 쌓인다 — 이미 담긴 매물은 건너뛰고 added 에 안 센다")
	void addAccumulates() throws Exception {
		addCompare(buyer, 0).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(1)).andExpect(jsonPath("$.data.added").value(1));
		addCompare(buyer, 1).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(2));
		addCompare(buyer, 1, 2).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(3)).andExpect(jsonPath("$.data.added").value(1));
		addCompare(buyer, 2).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(3)).andExpect(jsonPath("$.data.added").value(0));
		assertThat(compareProdDates()).containsExactly(REGS[0], REGS[1], REGS[2]);
		assertThat(compareTradeRows()).isEqualTo(3);
	}

	@Test
	@DisplayName("담아서 5개가 되면 400 COMPARE_FULL — 아무것도 안 담고 기존 목록 그대로, 4개까지는 OK")
	void addRejectsOverFour() throws Exception {
		addCompare(buyer, 0, 1, 2).andExpect(status().isOk());
		addCompare(buyer, 3).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(4));
		addCompare(buyer, 4).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMPARE_FULL"));
		assertThat(compareProdDates()).containsExactly(REGS[0], REGS[1], REGS[2], REGS[3]);
		addCompare(buyer, 0, 1, 2, 3, 4).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMPARE_FULL"));
		assertThat(compareTradeRows()).isEqualTo(4);
	}

	@Test
	@DisplayName("담을 때 기존 목록과 소분류가 다르면 400 COMPARE_CATEGORY_MISMATCH — 기존 목록 그대로. 내 매물은 403")
	void addChecksCategoryAndOwner() throws Exception {
		addCompare(buyer, 0).andExpect(status().isOk());
		addCompare(buyer, 5).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMPARE_CATEGORY_MISMATCH"));
		addCompare(buyer, 1, 5).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMPARE_CATEGORY_MISMATCH"));
		assertThat(compareProdDates()).containsExactly(REGS[0]);
		addCompare(seller, 0).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("TRADE_OWN_LISTING"));
	}

	@Test
	@DisplayName("구매하면 그 매물만 비교에서 빠지고(두 테이블), 견적 요청은 비교를 건드리지 않는다")
	void purchaseDropsOnlyThatCompareRow() throws Exception {
		addCompare(buyer, 0, 1, 2).andExpect(status().isOk());
		// 견적 요청은 아직 사는 게 아니다 — 비교에 그대로
		mvc.perform(post("/api/v1/trades/quotes").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderUnitPrice\":900,\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}]}"
				.formatted(sellerId, REGS[1])))
			.andExpect(status().isCreated());
		assertThat(compareProdDates()).containsExactly(REGS[0], REGS[1], REGS[2]);
		// 구매요청이 만들어지면 그 매물만 빠진다
		mvc.perform(post("/api/v1/trades").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}".formatted(sellerId, REGS[0])))
			.andExpect(status().isCreated());
		assertThat(compareProdDates()).containsExactly(REGS[1], REGS[2]);
		assertThat(compareTradeRows()).isEqualTo(2);
		mvc.perform(get("/api/v1/cart/compare").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(2)));
		// 비교에 없던 매물을 사도 오류 없이 — 남은 비교는 그대로
		mvc.perform(post("/api/v1/trades").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":3,\"reqDeliDate\":\"2099-12-31\"}".formatted(sellerId, REGS[3])))
			.andExpect(status().isCreated());
		assertThat(compareProdDates()).containsExactly(REGS[1], REGS[2]);
	}

	@Test
	@DisplayName("비우기는 내 비교 목록만 전부 지운다(두 테이블) — 비운 뒤 다른 소분류도 담을 수 있고, 다른 사람 목록은 그대로")
	void clearDeletesOnlyMine() throws Exception {
		addCompare(buyer, 0, 1).andExpect(status().isOk());
		mvc.perform(delete("/api/v1/cart/compare").cookie(seller)).andExpect(status().isNoContent());
		assertThat(compareTradeRows()).isEqualTo(2);
		mvc.perform(delete("/api/v1/cart/compare").cookie(buyer)).andExpect(status().isNoContent());
		assertThat(compareTradeRows()).isZero();
		assertThat(compareProdDates()).isEmpty();
		addCompare(buyer, 5).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(1));
		mvc.perform(delete("/api/v1/cart/compare").cookie(buyer)).andExpect(status().isNoContent());
		mvc.perform(delete("/api/v1/cart/compare").cookie(buyer)).andExpect(status().isNoContent());
	}

	@Test
	@DisplayName("거래완료 매물도 비교할 수 있다 (보기만)")
	void compareAllowsCompleted() throws Exception {
		compare(buyer, 3, 4).andExpect(status().isOk());
	}

	@Test
	@DisplayName("한 매물이 장바구니와 비교에 각각 1줄")
	void sameListingInCartAndCompare() throws Exception {
		mvc.perform(post("/api/v1/cart").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":1,\"reqDeliDate\":\"2099-12-31\"}]}"
				.formatted(sellerId, REGS[0])))
			.andExpect(status().isOk());
		compare(buyer, 0, 1).andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where prod_reg_date = ?", Integer.class, REGS[0])).isEqualTo(2);
		mvc.perform(get("/api/v1/cart/count").cookie(buyer)).andExpect(jsonPath("$.data.count").value(1));
	}

	@Test
	@DisplayName("목록은 담은 순서, 지금 매물 값과 tradeId. 빼기는 두 테이블 삭제 — 남의 거래ID가 섞이면 404 로 전부 되돌림")
	void listAndRemove() throws Exception {
		compare(buyer, 0, 1, 2).andExpect(status().isOk());
		jdbc.update("update trd_prod_reg set sales_unit_price = 800 where reg_date = ?", REGS[0]);
		mvc.perform(get("/api/v1/cart/compare").cookie(buyer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(3)))
			.andExpect(jsonPath("$.data.items[0].listing.regDate").value(REGS[0]))
			.andExpect(jsonPath("$.data.items[0].listing.salesUnitPrice").value(800))
			.andExpect(jsonPath("$.data.items[0].tradeId").isString());
		String first = jdbc.queryForObject("select trade_id from trd_cart_info where prod_date = ?", String.class, REGS[0]);
		mvc.perform(post("/api/v1/cart/compare/remove").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"tradeIds\":[\"" + first + "\"]}")).andExpect(status().isNoContent());
		assertThat(compareTradeRows()).isEqualTo(2);
		assertThat(compareProdDates()).containsExactly(REGS[1], REGS[2]);
		mvc.perform(post("/api/v1/cart/compare/remove").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"tradeIds\":[\"" + first + "\"]}")).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("TRADE_NOT_FOUND"));
		mvc.perform(get("/api/v1/cart/compare").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("비교 행은 판매자 목록·pendingCounts·내 구매목록에 안 보인다")
	void compareHiddenFromTradeLists() throws Exception {
		compare(buyer, 0, 1).andExpect(status().isOk());
		mvc.perform(get("/api/v1/trades").param("role", "seller").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(0)));
		mvc.perform(get("/api/v1/trades/pending-counts").cookie(seller)).andExpect(jsonPath("$.data." + REGS[0]).doesNotExist());
		mvc.perform(get("/api/v1/trades").param("role", "buyer").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("로그인 안 하면 401")
	void requiresLogin() throws Exception {
		mvc.perform(put("/api/v1/cart/compare").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[]}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/cart/compare").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[]}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(delete("/api/v1/cart/compare")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/cart/compare")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/cart/compare/remove").contentType(MediaType.APPLICATION_JSON).content("{\"tradeIds\":[\"x\"]}"))
			.andExpect(status().isUnauthorized());
	}

}
