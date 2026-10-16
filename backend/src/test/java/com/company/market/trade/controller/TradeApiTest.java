package com.company.market.trade.controller;

import java.time.LocalDate;
import java.time.ZoneId;
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
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.service.TradeService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 구매요청·거래완료·취소·목록 API. 데이터는 repository·jdbc 로 직접 만든다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TradeApiTest {

	static final String REG_DATE = "20261015100000";

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

	@Autowired
	TradeService tradeService;

	UUID sellerId;

	UUID buyerId;

	Cookie seller;

	Cookie buyer;

	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = newUser("tradeseller", "01012340001");
		buyerId = newUser("tradebuyer", "01012340002");
		seller = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(sellerId));
		buyer = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(buyerId));
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
			.nickname(loginId).email(loginId + "@example.com").name("홍길동").phone(phone).phoneHash(hasher.hash(phone))
			.build()).getId();
	}

	/** 판매자 매물: 단가·재고·최소주문량·주문단위·납기일(null 이면 없음) */
	private void listing(int price, int stock, int minOrder, int unit, String deliveryDate) {
		productRepository.saveAndFlush(Product.builder().prodId("TRADEAPI01").categoryCode("P01-Q01-R001")
			.prodName("서버 R740").prodBrand("Dell").regDate(REG_DATE).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(REG_DATE).prodId("TRADEAPI01")
			.tradeType("등록").prodState("신품대비 90%").salesUnitPrice(price).salesQuantity(stock).stockQuantity(stock)
			.minOrderQuantity(minOrder).orderUnit(unit).deliveryDate(deliveryDate).build());
	}

	private ResultActions request(Cookie who, String body) throws Exception {
		return mvc.perform(post("/api/v1/trades").cookie(who).contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private String body(int quantity, String reqDeliDate) {
		return """
				{"sellerId":"%s","regDate":"%s","orderQuantity":%d%s,"remarks":"빠른 납품 부탁"}
				""".formatted(sellerId, REG_DATE, quantity, reqDeliDate == null ? "" : ",\"reqDeliDate\":\"" + reqDeliDate + "\"");
	}

	private Integer stock() {
		return jdbc.queryForObject("select stock_quantity from trd_prod_reg where user_id = ?", Integer.class, sellerId);
	}

	private static String future() {
		return LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(7).toString();
	}

	// ---- 구매요청 ----

	@Test
	@DisplayName("구매요청: 재고가 줄고 거래정보가 매물 값 복사로 생긴다")
	void requestReservesStockAndCopiesListing() throws Exception {
		listing(1000, 10, 2, 2, "2099-12-31");

		request(buyer, body(4, future()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.tradeStats").value("requested"))
			.andExpect(jsonPath("$.data.amount").value(4000))
			.andExpect(jsonPath("$.data.orderUnitPrice").value(1000))
			.andExpect(jsonPath("$.data.prodName").value("서버 R740"))
			.andExpect(jsonPath("$.data.counterpartNickname").value("tradeseller"))
			.andExpect(jsonPath("$.data.tradeId").value(org.hamcrest.Matchers.matchesPattern("\\d{11}")));

		assertThat(stock()).isEqualTo(6);
		var row = jdbc.queryForMap("select * from trd_trade_info where user_id = ?", buyerId);
		assertThat(row.get("seller_id")).isEqualTo(sellerId);
		assertThat(row.get("prod_id")).isEqualTo("TRADEAPI01");
		assertThat(row.get("prod_state")).isEqualTo("신품대비 90%");
		assertThat(row.get("sales_unit_price")).isEqualTo(1000);
		assertThat(row.get("stock_quantity")).isEqualTo(10);
		assertThat(row.get("prov_date")).isEqualTo("2099-12-31");
		assertThat(row.get("order_unit_price")).isEqualTo(1000);
		assertThat(row.get("trade_type")).isEqualTo("구매요청");
		assertThat(row.get("trade_stats")).isEqualTo("구매요청");
		assertThat(row.get("remarks")).isEqualTo("빠른 납품 부탁");
	}

	@Test
	@DisplayName("로그인 없이 구매요청하면 401")
	void requestRequiresAuth() throws Exception {
		listing(1000, 10, 1, 1, null);
		mvc.perform(post("/api/v1/trades").contentType(MediaType.APPLICATION_JSON).content(body(1, future())))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("내 매물은 구매할 수 없다 — 403 TRADE_OWN_LISTING")
	void cannotBuyOwnListing() throws Exception {
		listing(1000, 10, 1, 1, null);
		request(seller, body(1, future())).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("TRADE_OWN_LISTING"));
		assertThat(stock()).isEqualTo(10);
	}

	@Test
	@DisplayName("거래완료된 매물은 409 LISTING_COMPLETED")
	void completedListingRejected() throws Exception {
		listing(1000, 10, 1, 1, null);
		jdbc.update("update trd_prod_reg set dt_expire = '20261015120000'");
		request(buyer, body(1, future())).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("LISTING_COMPLETED"));
	}

	@Test
	@DisplayName("없는 매물은 404")
	void missingListing() throws Exception {
		request(buyer, body(1, future())).andExpect(status().isNotFound());
	}

	@Test
	@DisplayName("최소주문량 미만·주문단위 배수 아님·금액 int 초과는 400 fields.orderQuantity")
	void quantityRules() throws Exception {
		listing(1000, 100, 4, 2, null);
		request(buyer, body(2, future())).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.orderQuantity").value("최소주문량(4) 이상 주문해 주세요."));
		request(buyer, body(5, future())).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.orderQuantity").value("주문단위(2)의 배수로 주문해 주세요."));
		assertThat(stock()).isEqualTo(100);
	}

	@Test
	@DisplayName("단가 × 수량이 int 범위를 넘으면 400 fields.orderQuantity")
	void amountOverflow() throws Exception {
		listing(1_000_000_000, 100, 1, 1, null);
		request(buyer, body(3, future())).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.orderQuantity").value("한 번에 주문할 수 있는 금액을 넘었습니다."));
	}

	@Test
	@DisplayName("납기일 없는 매물에 납품희망일을 비우면 400 fields.reqDeliDate")
	void reqDeliDateRequiredWithoutListingDate() throws Exception {
		listing(1000, 10, 1, 1, null);
		request(buyer, body(1, null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.reqDeliDate").value("납품희망일을 입력해 주세요."));
	}

	@Test
	@DisplayName("과거 납품희망일은 400, 형식이 틀리면 400")
	void pastOrMalformedReqDeliDate() throws Exception {
		listing(1000, 10, 1, 1, null);
		request(buyer, body(1, "2020-01-01")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.reqDeliDate").value("납품희망일은 오늘 이후 날짜로 입력하세요."));
		request(buyer, body(1, "2026/10/20")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.reqDeliDate").exists());
	}

	@Test
	@DisplayName("납품희망일을 비우면 매물 납기일이 들어간다")
	void reqDeliDateDefaultsToListingDate() throws Exception {
		listing(1000, 10, 1, 1, "2099-12-31");
		request(buyer, body(1, null)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.reqDeliDate").value("2099-12-31"));
	}

	@Test
	@DisplayName("재고보다 많이 주문하면 409 TRADE_OUT_OF_STOCK, 재고는 그대로")
	void outOfStock() throws Exception {
		listing(1000, 3, 1, 1, null);
		request(buyer, body(4, future())).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("TRADE_OUT_OF_STOCK"));
		assertThat(stock()).isEqualTo(3);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class)).isZero();
	}

	@Test
	@DisplayName("동시 요청: 재고 5에 3개씩 2건이면 하나만 성공하고 재고는 2")
	void concurrentRequestsCannotOversell() throws Exception {
		listing(1000, 5, 1, 1, null);
		UUID secondBuyer = newUser("tradebuyer2", "01012340003");
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Boolean>> results = new ArrayList<>();
		for (UUID who : List.of(buyerId, secondBuyer)) {
			results.add(pool.submit(() -> {
				start.await();
				try {
					tradeService.request(who, new TradeCreateRequest(sellerId, REG_DATE, 3, future(), null));
					return true;
				}
				catch (ApiException e) {
					assertThat(e.getCode()).isEqualTo(ErrorCode.TRADE_OUT_OF_STOCK);
					return false;
				}
			}));
		}
		start.countDown();
		int succeeded = 0;
		for (Future<Boolean> r : results) {
			succeeded += r.get() ? 1 : 0;
		}
		pool.shutdown();

		assertThat(succeeded).isEqualTo(1);
		assertThat(stock()).isEqualTo(2);
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class)).isEqualTo(1);
	}

	@Test
	@DisplayName("같은 Idempotency-Key 로 다시 보내면 같은 거래를 돌려주고 재고는 한 번만 준다")
	void idempotentRequest() throws Exception {
		listing(1000, 10, 1, 1, null);
		String key = UUID.randomUUID().toString();
		String first = mvc.perform(post("/api/v1/trades").cookie(buyer).header("Idempotency-Key", key)
				.contentType(MediaType.APPLICATION_JSON).content(body(2, future())))
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		String tradeId = first.replaceAll(".*\"tradeId\":\"([^\"]+)\".*", "$1");

		mvc.perform(post("/api/v1/trades").cookie(buyer).header("Idempotency-Key", key)
				.contentType(MediaType.APPLICATION_JSON).content(body(2, future())))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.tradeId").value(tradeId));
		assertThat(stock()).isEqualTo(8);
	}

	// ---- 거래완료·취소 ----

	private String requested(int quantity) {
		return tradeService.request(buyerId, new TradeCreateRequest(sellerId, REG_DATE, quantity, future(), null)).tradeId();
	}

	private ResultActions action(Cookie who, String tradeId, String what) throws Exception {
		return mvc.perform(post("/api/v1/trades/" + tradeId + "/" + what).cookie(who));
	}

	private int historyCount() {
		return jdbc.queryForObject("select count(*) from trd_trade_history", Integer.class);
	}

	private String statsOf(String tradeId) {
		return jdbc.queryForObject("select trade_stats from trd_trade_info where trade_id = ?", String.class, tradeId);
	}

	@Test
	@DisplayName("구매자가 거래완료하면 구매확정, 거래이력 1줄(구매확정·단가·수량·금액)")
	void buyerCompletes() throws Exception {
		listing(1000, 10, 1, 1, null);
		String tradeId = requested(3);

		action(buyer, tradeId, "complete").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tradeStats").value("confirmed"));

		assertThat(statsOf(tradeId)).isEqualTo("구매확정");
		assertThat(jdbc.queryForObject("select trade_type from trd_trade_info where trade_id = ?", String.class, tradeId))
			.isEqualTo("구매확정");
		var row = jdbc.queryForMap("select * from trd_trade_history where trade_id = ?", tradeId);
		assertThat(row.get("trade_type")).isEqualTo("구매확정");
		assertThat(row.get("prod_id")).isEqualTo("TRADEAPI01");
		assertThat(row.get("seller_id")).isEqualTo(sellerId);
		assertThat(row.get("buyer_id")).isEqualTo(buyerId);
		assertThat(row.get("trade_unit_price")).isEqualTo(1000);
		assertThat(row.get("trade_quantity")).isEqualTo(3);
		assertThat(row.get("trade_amount")).isEqualTo(3000);
		assertThat((String) row.get("trade_date")).hasSize(14);
		assertThat(stock()).isEqualTo(7);
	}

	@Test
	@DisplayName("판매자는 거래완료를 못 한다 — 403, 상태 그대로")
	void sellerCannotComplete() throws Exception {
		listing(1000, 10, 1, 1, null);
		String tradeId = requested(1);

		action(seller, tradeId, "complete").andExpect(status().isForbidden());
		assertThat(statsOf(tradeId)).isEqualTo("구매요청");
		assertThat(historyCount()).isZero();
	}

	@Test
	@DisplayName("구매자도 판매자도 아니면 취소 403")
	void strangerCannotCancel() throws Exception {
		listing(1000, 10, 1, 1, null);
		String tradeId = requested(1);
		Cookie stranger = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(newUser("tradestranger", "01012340009")));

		action(stranger, tradeId, "cancel").andExpect(status().isForbidden());
		assertThat(statsOf(tradeId)).isEqualTo("구매요청");
	}

	@Test
	@DisplayName("없는 거래는 404 TRADE_NOT_FOUND")
	void missingTrade() throws Exception {
		action(buyer, "26101510999", "complete").andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("TRADE_NOT_FOUND"));
	}

	@Test
	@DisplayName("판매자가 취소하면 취소·재고 복원, 재고 0이던 매물은 다시 판매 중이고 수정된다")
	void sellerCancelsRestoresStock() throws Exception {
		listing(1000, 4, 1, 1, null);
		String tradeId = requested(4);
		assertThat(jdbc.queryForObject("select dt_expire from trd_prod_reg where user_id = ?", String.class, sellerId)).isNotNull();

		action(seller, tradeId, "cancel").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tradeStats").value("canceled"));

		assertThat(statsOf(tradeId)).isEqualTo("취소");
		assertThat(jdbc.queryForObject("select trade_type from trd_trade_info where trade_id = ?", String.class, tradeId))
			.isEqualTo("구매취소");
		assertThat(stock()).isEqualTo(4);
		assertThat(jdbc.queryForObject("select dt_expire from trd_prod_reg where user_id = ?", String.class, sellerId)).isNull();
		assertThat(historyCount()).isZero();
		mvc.perform(patch("/api/v1/listings/" + sellerId + "/" + REG_DATE).cookie(seller)
				.contentType(MediaType.APPLICATION_JSON).content("{\"salesUnitPrice\":1200}"))
			.andExpect(status().isOk());
	}

	@Test
	@DisplayName("구매자도 취소할 수 있다")
	void buyerCancels() throws Exception {
		listing(1000, 10, 1, 1, null);
		String tradeId = requested(2);

		action(buyer, tradeId, "cancel").andExpect(status().isOk());
		assertThat(stock()).isEqualTo(10);
	}

	@Test
	@DisplayName("확정 뒤 취소·취소 뒤 확정·두 번 확정은 409 TRADE_NOT_PENDING, 이력은 1줄")
	void onlyPendingTradesChange() throws Exception {
		listing(1000, 10, 1, 1, null);
		String confirmed = requested(1);
		action(buyer, confirmed, "complete").andExpect(status().isOk());
		action(buyer, confirmed, "complete").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("TRADE_NOT_PENDING"));
		action(seller, confirmed, "cancel").andExpect(status().isConflict());

		String canceled = requested(1);
		action(buyer, canceled, "cancel").andExpect(status().isOk());
		action(buyer, canceled, "complete").andExpect(status().isConflict());
		action(buyer, canceled, "cancel").andExpect(status().isConflict());

		assertThat(historyCount()).isEqualTo(1);
		assertThat(stock()).isEqualTo(9);
	}

	@Test
	@DisplayName("구매자 확정과 판매자 취소가 동시에 오면 하나만 성공하고 재고·이력은 이긴 쪽과 맞다")
	void concurrentCompleteAndCancel() throws Exception {
		listing(1000, 10, 1, 1, null);
		String tradeId = requested(3);
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		Future<Boolean> complete = pool.submit(() -> {
			start.await();
			return attempt(() -> tradeService.complete(buyerId, tradeId));
		});
		Future<Boolean> cancel = pool.submit(() -> {
			start.await();
			return attempt(() -> tradeService.cancel(sellerId, tradeId));
		});
		start.countDown();
		boolean completed = complete.get();
		boolean canceled = cancel.get();
		pool.shutdown();

		assertThat(completed ^ canceled).isTrue();
		assertThat(historyCount()).isEqualTo(completed ? 1 : 0);
		assertThat(stock()).isEqualTo(completed ? 7 : 10);
	}

	private static boolean attempt(Runnable action) {
		try {
			action.run();
			return true;
		}
		catch (ApiException e) {
			assertThat(e.getCode()).isEqualTo(ErrorCode.TRADE_NOT_PENDING);
			return false;
		}
	}

}
