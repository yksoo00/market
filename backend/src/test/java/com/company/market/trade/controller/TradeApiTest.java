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
import java.util.concurrent.TimeUnit;
import java.util.concurrent.CompletableFuture;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.dto.ListingUpdateRequest;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.listing.service.ListingService;
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
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

	@Autowired
	ListingService listingService;

	@Autowired
	TransactionTemplate tx;

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

	/** 별명 사용(Y) 사용자 — 별명이 로그인 아이디와 같아 테스트에서 알아보기 쉽다 */
	private UUID newUser(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).nicknameUsage("Y").email(loginId + "@example.com").name("홍길동").phone(phone)
			.phoneHash(hasher.hash(phone)).build()).getId();
	}

	@Test
	@DisplayName("별명을 쓰지 않는 상대는 로그인 아이디를 보여 주지 않는다 (counterpartNickname 없음)")
	void counterpartWithoutNicknameHidesLoginId() throws Exception {
		jdbc.update("update trd_user_info set nickname_usage = 'N' where uid = ?", sellerId);
		listing(1000, 10, 1, 1, null);
		request(buyer, body(1, future())).andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.counterpartNickname").value(org.hamcrest.Matchers.nullValue()));
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
			.andExpect(jsonPath("$.data.tradeType").value("purchase"))
			.andExpect(jsonPath("$.data.salesUnitPrice").value(1000))
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
		assertThat(row.get("trade_type")).isEqualTo("거래");
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
	@DisplayName("납품희망일을 비웠는데 매물 납기일이 지났으면 400 '매물 납기일이 지났습니다', 오늘이면 통과")
	void emptyReqDeliDateWithPastListingDate() throws Exception {
		listing(1000, 10, 1, 1, "2020-01-01");
		request(buyer, body(1, null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.reqDeliDate").value("매물 납기일이 지났습니다. 납품희망일을 입력해 주세요."));

		String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
		jdbc.update("update trd_prod_reg set prov_date = ? where user_id = ?", today, sellerId);
		request(buyer, body(1, null)).andExpect(status().isCreated());
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
	@DisplayName("매물 삭제와 첫 구매요청이 동시에 와도 500 은 없다 — 삭제가 이기면 구매 404, 구매가 이기면 삭제 409")
	void deleteAndFirstRequestRace() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			for (int i = 0; i < 20; i++) {
				jdbc.update("delete from trd_trade_info");
				jdbc.update("delete from trd_prod_reg");
				jdbc.update("delete from trd_prod_master");
				listing(1000, 10, 1, 1, null);
				CountDownLatch start = new CountDownLatch(1);
				Future<String> delete = pool.submit(() -> outcome(start,
						() -> listingService.delete(sellerId, REG_DATE, sellerId)));
				Future<String> request = pool.submit(() -> outcome(start,
						() -> tradeService.request(buyerId, new TradeCreateRequest(sellerId, REG_DATE, 1, future(), null))));
				start.countDown();
				String deleted = delete.get();
				String requested = request.get();

				int listings = jdbc.queryForObject("select count(*) from trd_prod_reg", Integer.class);
				int tradeRows = jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class);
				if ("ok".equals(deleted)) {
					assertThat(requested).isEqualTo(ErrorCode.LISTING_NOT_FOUND.name());
					assertThat(listings).isZero();
					assertThat(tradeRows).isZero();
				}
				else {
					assertThat(deleted).isEqualTo(ErrorCode.LISTING_HAS_TRADES.name());
					assertThat(requested).isEqualTo("ok");
					assertThat(listings).isEqualTo(1);
					assertThat(tradeRows).isEqualTo(1);
				}
			}
		}
		finally {
			pool.shutdown();
		}
	}

	/** "ok" | ApiException 코드 | 그 밖의 예외(= 500) 클래스 이름 */
	private static String outcome(CountDownLatch start, Runnable action) throws InterruptedException {
		start.await();
		try {
			action.run();
			return "ok";
		}
		catch (ApiException e) {
			return e.getCode().name();
		}
		catch (RuntimeException e) {
			return e.getClass().getName() + ": " + e.getMessage();
		}
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

	@Test
	@DisplayName("판매자가 단가를 고치는 중에 온 구매요청은 고친 뒤의 단가로 저장된다 (옛 스냅샷으로 저장되지 않는다)")
	void requestWaitsForConcurrentListingEdit() throws Exception {
		listing(1000, 10, 1, 1, null);
		CountDownLatch edited = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		// 판매자 수정: 단가 2000 으로 바꾸고 커밋 전에 멈춘다 (행 잠금을 쥔 채)
		CompletableFuture<Void> edit = CompletableFuture.runAsync(() -> tx.executeWithoutResult(s -> {
			listingService.update(sellerId, REG_DATE, sellerId, new ListingUpdateRequest(null, null, 2000, null, null, null,
					null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null));
			edited.countDown();
			try {
				release.await(10, TimeUnit.SECONDS);
			}
			catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}));
		assertThat(edited.await(10, TimeUnit.SECONDS)).isTrue();
		CompletableFuture<String> purchase = CompletableFuture.supplyAsync(() -> requested(1));
		Thread.sleep(300);
		release.countDown();
		edit.get(10, TimeUnit.SECONDS);
		String tradeId = purchase.get(10, TimeUnit.SECONDS);

		assertThat(jdbc.queryForObject("select order_unit_price from trd_trade_info where trade_id = ?", Integer.class, tradeId))
			.isEqualTo(2000);
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
			.isEqualTo("거래");
		var row = jdbc.queryForMap("select * from trd_trade_history where trade_id = ?", tradeId);
		assertThat(row.get("trade_type")).isEqualTo("거래");
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
	@DisplayName("판매자가 취소하면 거래 행이 지워지고 재고 복원, 재고 0이던 매물은 다시 판매 중이고 수정된다")
	void sellerCancelsRestoresStock() throws Exception {
		listing(1000, 4, 1, 1, null);
		String tradeId = requested(4);
		assertThat(jdbc.queryForObject("select dt_expire from trd_prod_reg where user_id = ?", String.class, sellerId)).isNotNull();

		action(seller, tradeId, "cancel").andExpect(status().isNoContent());

		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info where trade_id = ?", Integer.class, tradeId)).isZero();
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

		action(buyer, tradeId, "cancel").andExpect(status().isNoContent());
		assertThat(stock()).isEqualTo(10);
	}

	@Test
	@DisplayName("확정 뒤 취소·두 번 확정은 409 TRADE_NOT_PENDING, 취소한(지워진) 거래는 404, 이력은 1줄")
	void onlyPendingTradesChange() throws Exception {
		listing(1000, 10, 1, 1, null);
		String confirmed = requested(1);
		action(buyer, confirmed, "complete").andExpect(status().isOk());
		action(buyer, confirmed, "complete").andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("TRADE_NOT_PENDING"));
		action(seller, confirmed, "cancel").andExpect(status().isConflict());

		String canceled = requested(1);
		action(buyer, canceled, "cancel").andExpect(status().isNoContent());
		action(buyer, canceled, "complete").andExpect(status().isNotFound());
		action(buyer, canceled, "cancel").andExpect(status().isNotFound());

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
			// 취소가 이기면 행이 지워져 나중에 읽는 쪽은 404
			assertThat(e.getCode()).isIn(ErrorCode.TRADE_NOT_PENDING, ErrorCode.TRADE_NOT_FOUND);
			return false;
		}
	}

	// ---- 목록·요청 건수 ----

	static final String REG_DATE_2 = "20261015100001";

	private void secondListing() {
		productRepository.saveAndFlush(Product.builder().prodId("TRADEAPI02").categoryCode("P01-Q01-R001")
			.prodName("스위치 C9300").prodBrand("Cisco").regDate(REG_DATE_2).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(REG_DATE_2).prodId("TRADEAPI02")
			.tradeType("등록").prodState("신품").salesUnitPrice(500).salesQuantity(100).stockQuantity(100)
			.minOrderQuantity(1).orderUnit(1).build());
	}

	private String requestAs(UUID who, String regDate, int quantity, String remarks) {
		return tradeService.request(who, new TradeCreateRequest(sellerId, regDate, quantity, future(), remarks)).tradeId();
	}

	@Test
	@DisplayName("구매자 목록: 내 거래만 최신순, 상대 닉네임은 판매자, 이메일·전화 없음")
	void buyerList() throws Exception {
		listing(1000, 100, 1, 1, null);
		UUID other = newUser("tradebuyer2", "01012340003");
		String first = requestAs(buyerId, REG_DATE, 1, null);
		requestAs(other, REG_DATE, 1, null);
		String second = requestAs(buyerId, REG_DATE, 2, null);

		mvc.perform(get("/api/v1/trades?role=buyer").cookie(buyer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(2)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(second))
			.andExpect(jsonPath("$.data.items[1].tradeId").value(first))
			.andExpect(jsonPath("$.data.items[0].counterpartNickname").value("tradeseller"))
			.andExpect(jsonPath("$.data.items[0].prodName").value("서버 R740"))
			.andExpect(jsonPath("$.data.items[0].email").doesNotExist())
			.andExpect(jsonPath("$.data.items[0].phone").doesNotExist())
			.andExpect(jsonPath("$.data.nextCursor").value(nullValue()));
	}

	@Test
	@DisplayName("판매자 목록: 받은 요청만, reg 로 한 매물만, 상대 닉네임은 구매자")
	void sellerListFilteredByListing() throws Exception {
		listing(1000, 100, 1, 1, null);
		secondListing();
		requestAs(buyerId, REG_DATE, 1, "첫 매물");
		String onSecond = requestAs(buyerId, REG_DATE_2, 1, "둘째 매물");

		mvc.perform(get("/api/v1/trades?role=seller").cookie(seller))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(2)));
		mvc.perform(get("/api/v1/trades?role=seller&reg=" + REG_DATE_2).cookie(seller))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(onSecond))
			.andExpect(jsonPath("$.data.items[0].remarks").value("둘째 매물"))
			.andExpect(jsonPath("$.data.items[0].counterpartNickname").value("tradebuyer"));
		// 구매자에게 판매자 목록은 비어 있다 (남의 매물 요청이 안 보임)
		mvc.perform(get("/api/v1/trades?role=seller").cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("20개가 넘으면 nextCursor 로 다음 페이지")
	void cursorPaging() throws Exception {
		listing(1, 1000, 1, 1, null);
		for (int i = 0; i < 21; i++) {
			requestAs(buyerId, REG_DATE, 1, null);
		}
		String page = mvc.perform(get("/api/v1/trades?role=buyer").cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(20)))
			.andReturn().getResponse().getContentAsString();
		String cursor = page.replaceAll(".*\"nextCursor\":\"([^\"]+)\".*", "$1");

		mvc.perform(get("/api/v1/trades?role=buyer&cursor=" + cursor).cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.nextCursor").value(nullValue()));
	}

	@Test
	@DisplayName("거래 목록 커서 형식이 틀리면 400 fields.cursor, 비우면 첫 페이지")
	void malformedCursor() throws Exception {
		mvc.perform(get("/api/v1/trades?role=buyer&cursor=abc").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.fields.cursor").exists());
		mvc.perform(get("/api/v1/trades?role=buyer&cursor=").cookie(buyer)).andExpect(status().isOk());
	}

	@Test
	@DisplayName("판매자가 매물 상품명을 바꿔도 거래 내역의 상품명은 구매 때 이름")
	void tradeKeepsProductNameAtPurchase() throws Exception {
		listing(1000, 10, 1, 1, null);
		String tradeId = requested(1);
		mvc.perform(patch("/api/v1/listings/" + sellerId + "/" + REG_DATE).cookie(seller)
				.contentType(MediaType.APPLICATION_JSON).content("{\"prodName\":\"새 이름 서버\"}"))
			.andExpect(status().isOk());

		mvc.perform(get("/api/v1/trades?role=buyer").cookie(buyer))
			.andExpect(jsonPath("$.data.items[0].prodName").value("서버 R740"));
		action(buyer, tradeId, "complete").andExpect(jsonPath("$.data.prodName").value("서버 R740"));
	}

	@Test
	@DisplayName("role 이 없거나 다른 값이면 400 fields.role, 비로그인은 401")
	void listValidation() throws Exception {
		mvc.perform(get("/api/v1/trades").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.role").exists());
		mvc.perform(get("/api/v1/trades?role=admin").cookie(buyer)).andExpect(status().isBadRequest());
		mvc.perform(get("/api/v1/trades?role=buyer")).andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("pending-counts: 내 매물별 구매요청 상태 건수만")
	void pendingCounts() throws Exception {
		listing(1000, 100, 1, 1, null);
		secondListing();
		requestAs(buyerId, REG_DATE, 1, null);
		requestAs(buyerId, REG_DATE, 1, null);
		tradeService.cancel(buyerId, requestAs(buyerId, REG_DATE, 1, null));
		tradeService.complete(buyerId, requestAs(buyerId, REG_DATE, 1, null));
		requestAs(buyerId, REG_DATE_2, 1, null);

		mvc.perform(get("/api/v1/trades/pending-counts").cookie(seller))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data['" + REG_DATE + "']").value(2))
			.andExpect(jsonPath("$.data['" + REG_DATE_2 + "']").value(1));
		mvc.perform(get("/api/v1/trades/pending-counts").cookie(buyer))
			.andExpect(jsonPath("$.data").isEmpty());
	}

}
