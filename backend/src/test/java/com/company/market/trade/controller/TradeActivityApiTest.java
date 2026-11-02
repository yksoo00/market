package com.company.market.trade.controller;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 내 거래이력 · 검색 범위 판정 · 내 구매 매물 검색 (설계 2026-10-27 PR 4) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TradeActivityApiTest {

	static final String REG_A = "20261015100000";

	static final String REG_B = "20261015110000";

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

	UUID strangerId;

	Cookie seller;

	Cookie buyer;

	Cookie stranger;

	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = newUser("actseller", "01012350001");
		buyerId = newUser("actbuyer", "01012350002");
		strangerId = newUser("actstranger", "01012350003");
		seller = cookie(sellerId);
		buyer = cookie(buyerId);
		stranger = cookie(strangerId);
		listing("ACTAPI01", REG_A, "서버 R740", "Dell");
		listing("ACTAPI02", REG_B, "스위치 C9300", "Cisco");
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_trade_history");
		jdbc.update("delete from trd_cart_info");
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
		jdbc.update("delete from trd_user_info");
	}

	private Cookie cookie(UUID id) {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(id));
	}

	private UUID newUser(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).nicknameUsage("Y").email(loginId + "@example.com").name("홍길동").phone(phone)
			.phoneHash(hasher.hash(phone)).build()).getId();
	}

	private void listing(String prodId, String regDate, String name, String brand) {
		productRepository.saveAndFlush(Product.builder().prodId(prodId).majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName(name).prodBrand(brand).regDate(regDate).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(regDate).prodId(prodId)
			.tradeType("등록").prodState("신품").salesUnitPrice(1000).salesQuantity(100).stockQuantity(100)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
	}

	private String future() {
		return LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(7).toString();
	}

	private String buy(UUID who, String regDate, int quantity) {
		return tradeService.request(who, new TradeCreateRequest(sellerId, regDate, quantity, future(), null)).tradeId();
	}

	private void addToCart(Cookie who, String regDate) throws Exception {
		mvc.perform(post("/api/v1/cart").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"items\":[{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":1,\"reqDeliDate\":\"%s\"}]}"
				.formatted(sellerId, regDate, future())))
			.andExpect(status().isOk());
	}

	private void complete(Cookie who, String tradeId) throws Exception {
		mvc.perform(post("/api/v1/trades/" + tradeId + "/complete").cookie(who)).andExpect(status().isOk());
	}

	// ---- 범위 판정 ----

	@Test
	@DisplayName("범위: 판매만 / 구매만 / 둘 다 / 둘 다 없음")
	void scopes() throws Exception {
		// 판매자: 매물이 있고 구매는 없다
		mvc.perform(get("/api/v1/trades/scopes").cookie(seller)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.sales").value(true)).andExpect(jsonPath("$.data.purchases").value(false));
		// 장바구니만 담은 구매자: 구매검토는 구매 거래가 아니다 → 둘 다 없음
		addToCart(buyer, REG_A);
		mvc.perform(get("/api/v1/trades/scopes").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.sales").value(false)).andExpect(jsonPath("$.data.purchases").value(false));
		// 구매요청을 하면 구매만
		buy(buyerId, REG_B, 1);
		mvc.perform(get("/api/v1/trades/scopes").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.sales").value(false)).andExpect(jsonPath("$.data.purchases").value(true));
		// 매물도 올린 구매자: 둘 다
		listingRepository.saveAndFlush(Listing.builder().userId(buyerId).regDate("20261016100000").prodId("ACTAPI01")
			.tradeType("등록").prodState("신품").salesUnitPrice(1).salesQuantity(1).stockQuantity(1)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
		mvc.perform(get("/api/v1/trades/scopes").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.sales").value(true)).andExpect(jsonPath("$.data.purchases").value(true));
		mvc.perform(get("/api/v1/trades/scopes").cookie(stranger)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.sales").value(false)).andExpect(jsonPath("$.data.purchases").value(false));
	}

	@Test
	@DisplayName("범위: 거래 행이 없어도 거래이력이 있으면 구매 범위")
	void scopesByHistoryOnly() throws Exception {
		jdbc.update("""
				insert into trd_trade_history (user_id, trade_id, trade_date, prod_id, trade_type, seller_id)
				values (?, '20261015001', '20261015120000', 'ACTAPI01', '거래', ?)
				""", strangerId, sellerId);
		mvc.perform(get("/api/v1/trades/scopes").cookie(stranger)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.purchases").value(true));
	}

	@Test
	@DisplayName("범위·이력·내 구매 검색은 로그인이 필요하다")
	void requiresAuth() throws Exception {
		mvc.perform(get("/api/v1/trades/scopes")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/trades/history")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/trades/listings")).andExpect(status().isUnauthorized());
	}

	// ---- 거래이력 ----

	@Test
	@DisplayName("이력: 구매 탭은 내가 구매자인 줄, 판매 탭은 내가 판매자인 줄, 전체는 둘 다. 남의 이력은 안 보인다")
	void historyTabs() throws Exception {
		String tradeId = buy(buyerId, REG_A, 3);
		complete(buyer, tradeId);

		mvc.perform(get("/api/v1/trades/history?side=buy").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(tradeId))
			.andExpect(jsonPath("$.data.items[0].side").value("buy"))
			.andExpect(jsonPath("$.data.items[0].prodName").value("서버 R740"))
			.andExpect(jsonPath("$.data.items[0].counterpartNickname").value("actseller"))
			.andExpect(jsonPath("$.data.items[0].unitPrice").value(1000))
			.andExpect(jsonPath("$.data.items[0].quantity").value(3))
			.andExpect(jsonPath("$.data.items[0].amount").value(3000))
			.andExpect(jsonPath("$.data.items[0].email").doesNotExist())
			.andExpect(jsonPath("$.data.nextCursor").doesNotExist());
		mvc.perform(get("/api/v1/trades/history?side=sell").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(0)));
		mvc.perform(get("/api/v1/trades/history?side=sell").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].side").value("sell"))
			.andExpect(jsonPath("$.data.items[0].counterpartNickname").value("actbuyer"));
		mvc.perform(get("/api/v1/trades/history?side=buy").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(0)));
		mvc.perform(get("/api/v1/trades/history").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(1)));
		mvc.perform(get("/api/v1/trades/history").cookie(stranger)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("이력: 구매확정 전(구매요청)은 이력에 없다")
	void historyOnlyConfirmed() throws Exception {
		buy(buyerId, REG_A, 1);
		mvc.perform(get("/api/v1/trades/history").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("이력: 20줄씩, 커서로 다음 장 (같은 확정일시여도 거래ID 로 이어진다)")
	void historyPaging() throws Exception {
		for (int i = 1; i <= 21; i++) {
			jdbc.update("""
					insert into trd_trade_history (user_id, trade_id, trade_date, prod_id, trade_type, seller_id, trade_unit_price, trade_quantity, trade_amount)
					values (?, ?, '20261015120000', 'ACTAPI01', '거래', ?, 100, 1, 100)
					""", buyerId, "202610150%02d".formatted(i), sellerId);
		}
		mvc.perform(get("/api/v1/trades/history?side=buy").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(20)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261015021"))
			.andExpect(jsonPath("$.data.nextCursor").value("2026101512000020261015002"));
		mvc.perform(get("/api/v1/trades/history?side=buy&cursor=2026101512000020261015002").cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261015001"))
			.andExpect(jsonPath("$.data.nextCursor").doesNotExist());
	}

	@Test
	@DisplayName("페이지 번호: 이력 page=1·3 으로 바로 가고 전체 건수·페이지 수를 주며, 범위 밖은 400")
	void historyPageNumbers() throws Exception {
		for (int i = 1; i <= 45; i++) {
			jdbc.update("""
					insert into trd_trade_history (user_id, trade_id, trade_date, prod_id, trade_type, seller_id, trade_unit_price, trade_quantity, trade_amount)
					values (?, ?, '20261015120000', 'ACTAPI01', '거래', ?, 100, 1, 100)
					""", buyerId, "202610150%02d".formatted(i), sellerId);
		}
		mvc.perform(get("/api/v1/trades/history?side=buy&page=1").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(20)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261015045"))
			.andExpect(jsonPath("$.data.page").value(1))
			.andExpect(jsonPath("$.data.totalPages").value(3))
			.andExpect(jsonPath("$.data.total").value(45));
		mvc.perform(get("/api/v1/trades/history?side=buy&page=3").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(5)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261015005"));
		mvc.perform(get("/api/v1/trades/history?side=buy&page=4").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.page").exists());
		// 판매자 쪽은 건수가 0 — 1페이지는 비어 있어도 있다
		mvc.perform(get("/api/v1/trades/history?side=buy&page=1").cookie(seller)).andExpect(jsonPath("$.data.total").value(0))
			.andExpect(jsonPath("$.data.totalPages").value(1));
	}

	@Test
	@DisplayName("페이지 번호: 거래 목록(구매자·판매자) page=2 와 진행 중 필터가 같이 걸린다")
	void tradeListPageNumbers() throws Exception {
		for (int i = 0; i < 21; i++) {
			buy(buyerId, REG_A, 1);
		}
		String confirmed = buy(buyerId, REG_B, 1);
		complete(buyer, confirmed);
		// active: 구매확정 한 건은 빠져 21건 → 2페이지
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=2").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.page").value(2))
			.andExpect(jsonPath("$.data.totalPages").value(2))
			.andExpect(jsonPath("$.data.total").value(21));
		mvc.perform(get("/api/v1/trades?role=seller&active=true&page=1").cookie(seller)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(20)))
			.andExpect(jsonPath("$.data.total").value(21));
		mvc.perform(get("/api/v1/trades?role=buyer&page=2").cookie(buyer)).andExpect(jsonPath("$.data.total").value(22));
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=3").cookie(buyer)).andExpect(status().isBadRequest());
		// 커서 방식은 그대로 — page 가 없으면 page 칸이 없다
		mvc.perform(get("/api/v1/trades?role=buyer").cookie(buyer)).andExpect(jsonPath("$.data.page").doesNotExist());
	}

	@Test
	@DisplayName("이력: 잘못된 side·cursor 는 400")
	void historyValidation() throws Exception {
		mvc.perform(get("/api/v1/trades/history?side=x").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.side").exists());
		mvc.perform(get("/api/v1/trades/history?cursor=abc").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.cursor").exists());
	}

	// ---- 거래이력 검색·필터 (계획 2026-10-30) ----

	/** 구매자 = buyer, 판매자 = seller 인 이력 한 줄 */
	private void history(String tradeId, String date, String prodId, int amount) {
		jdbc.update("""
				insert into trd_trade_history (user_id, trade_id, trade_date, prod_id, trade_type, seller_id, trade_unit_price, trade_quantity, trade_amount)
				values (?, ?, ?, ?, '거래', ?, ?, 1, ?)
				""", buyerId, tradeId, date, prodId, sellerId, amount, amount);
	}

	private void filterFixture() {
		history("20261001001", "20261001090000", "ACTAPI01", 1000); // 서버 R740
		history("20261005001", "20261005235959", "ACTAPI02", 5000); // 스위치 C9300
		history("20261010001", "20261010000000", "ACTAPI01", 3000); // 서버 R740
		history("20261010002", "20261010000000", "ACTAPI02", 3000); // 같은 일시·금액
	}

	@Test
	@DisplayName("이력 필터: 상품명 부분 일치(대소문자 무시), %·_ 는 글자, 없으면 빈 결과, 건수는 걸러진 기준")
	void historyFilterByName() throws Exception {
		filterFixture();
		mvc.perform(get("/api/v1/trades/history?page=1&q=r740").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.total").value(2))
			.andExpect(jsonPath("$.data.items", hasSize(2)))
			.andExpect(jsonPath("$.data.items[0].prodName").value("서버 R740"));
		// 값은 param 으로 — 주소 문자열에 넣으면 MockMvc 가 한 번 더 인코딩한다
		mvc.perform(get("/api/v1/trades/history?page=1").param("q", "스위치").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
		mvc.perform(get("/api/v1/trades/history?page=1").param("q", "%").cookie(buyer)).andExpect(jsonPath("$.data.total").value(0));
		mvc.perform(get("/api/v1/trades/history?page=1").param("q", "_").cookie(buyer)).andExpect(jsonPath("$.data.total").value(0));
		mvc.perform(get("/api/v1/trades/history?page=1&q=없는상품").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(0)))
			.andExpect(jsonPath("$.data.totalPages").value(1));
		mvc.perform(get("/api/v1/trades/history?page=1").param("q", "  ").cookie(buyer)).andExpect(jsonPath("$.data.total").value(4));
	}

	@Test
	@DisplayName("이력 검색 구분: all(기본)은 제조사도, name 은 상품명만, brand 는 제조사만. 낱말은 순서 상관없이 전부 맞아야 한다")
	void historySearchField() throws Exception {
		filterFixture();
		mvc.perform(get("/api/v1/trades/history?page=1&q=dell").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
		mvc.perform(get("/api/v1/trades/history?page=1&field=all&q=dell").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
		mvc.perform(get("/api/v1/trades/history?page=1&field=name&q=dell").cookie(buyer)).andExpect(jsonPath("$.data.total").value(0));
		mvc.perform(get("/api/v1/trades/history?page=1&field=brand&q=cisco").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
		mvc.perform(get("/api/v1/trades/history?page=1&field=brand&q=C9300").cookie(buyer)).andExpect(jsonPath("$.data.total").value(0));
		mvc.perform(get("/api/v1/trades/history?page=1").param("q", "R740 서버").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
		mvc.perform(get("/api/v1/trades/history?page=1").param("q", "R740 cisco").cookie(buyer)).andExpect(jsonPath("$.data.total").value(0));
	}

	@Test
	@DisplayName("검색어에 맞는 상품이 아주 많아도(600개) 내 거래 상품은 빠지지 않는다 — 내 거래 상품 안에서만 찾는다 (2026-11-02)")
	void searchDoesNotDropMyProductsWhenManyMatch() throws Exception {
		filterFixture();
		// 내 거래 상품(ACTAPI01, Dell)보다 상품ID 가 앞서는 남의 Dell 상품 600개 — 예전엔 앞 500개만 걸어 내 거래가 빠졌다
		jdbc.batchUpdate("""
				insert into trd_prod_master (prod_id, major_category, middle_category, minor_category, prod_name, prod_brand, reg_date)
				values (?, 'P01', 'Q01', 'R001', ?, 'Dell', '20261001000000')
				""", java.util.stream.IntStream.range(0, 600).mapToObj(i -> new Object[] { "AAAA%04d".formatted(i), "다른 상품 " + i }).toList());
		mvc.perform(get("/api/v1/trades/history?page=1&field=brand&q=dell").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
		buy(buyerId, REG_A, 1); // 서버 R740 (Dell)
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&field=brand&q=dell").cookie(buyer)).andExpect(jsonPath("$.data.total").value(1));
		mvc.perform(get("/api/v1/trades?role=seller&active=true&page=1&q=dell").cookie(seller)).andExpect(jsonPath("$.data.total").value(1));
	}

	@Test
	@DisplayName("이력 필터: 기간은 양끝 날짜를 포함한다 (to 날짜 23:59:59 까지)")
	void historyFilterByPeriod() throws Exception {
		filterFixture();
		mvc.perform(get("/api/v1/trades/history?page=1&from=2026-10-05&to=2026-10-05").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(1))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261005001"));
		mvc.perform(get("/api/v1/trades/history?page=1&from=2026-10-02").cookie(buyer)).andExpect(jsonPath("$.data.total").value(3));
		mvc.perform(get("/api/v1/trades/history?page=1&to=2026-10-04").cookie(buyer)).andExpect(jsonPath("$.data.total").value(1));
	}

	@Test
	@DisplayName("이력 필터: 금액 범위는 양끝 포함, 탭(구매/판매)·상품명과 함께 걸린다")
	void historyFilterByAmountAndCombined() throws Exception {
		filterFixture();
		mvc.perform(get("/api/v1/trades/history?page=1&minAmount=3000&maxAmount=3000").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(2));
		mvc.perform(get("/api/v1/trades/history?page=1&minAmount=3001").cookie(buyer)).andExpect(jsonPath("$.data.total").value(1));
		mvc.perform(get("/api/v1/trades/history?page=1&maxAmount=999").cookie(buyer)).andExpect(jsonPath("$.data.total").value(0));
		mvc.perform(get("/api/v1/trades/history?side=buy&page=1&q=R740&minAmount=2000").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(1))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261010001"));
		// 판매자 쪽 탭에서도 같은 필터
		mvc.perform(get("/api/v1/trades/history?side=sell&page=1&q=C9300").cookie(seller)).andExpect(jsonPath("$.data.total").value(2));
		// 구매 탭에서 판매자는 아무것도 못 본다
		mvc.perform(get("/api/v1/trades/history?side=buy&page=1&q=R740").cookie(seller)).andExpect(jsonPath("$.data.total").value(0));
	}

	@Test
	@DisplayName("이력 정렬: 최신·오래된·금액 높은/낮은 순, 같은 값이면 최신·거래ID 내림차순으로 끝을 맞춘다")
	void historySort() throws Exception {
		filterFixture();
		mvc.perform(get("/api/v1/trades/history?page=1").cookie(buyer))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261010002"))
			.andExpect(jsonPath("$.data.items[3].tradeId").value("20261001001"));
		mvc.perform(get("/api/v1/trades/history?page=1&sort=oldest").cookie(buyer))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261001001"))
			.andExpect(jsonPath("$.data.items[3].tradeId").value("20261010002"));
		mvc.perform(get("/api/v1/trades/history?page=1&sort=amountDesc").cookie(buyer))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261005001"))
			.andExpect(jsonPath("$.data.items[1].tradeId").value("20261010002"))
			.andExpect(jsonPath("$.data.items[2].tradeId").value("20261010001"));
		mvc.perform(get("/api/v1/trades/history?page=1&sort=amountAsc").cookie(buyer))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("20261001001"))
			.andExpect(jsonPath("$.data.items[1].tradeId").value("20261010002"))
			.andExpect(jsonPath("$.data.items[3].tradeId").value("20261005001"));
	}

	@Test
	@DisplayName("이력 정렬: 페이지를 넘겨도 정렬 순서가 이어진다 (금액 낮은 순 25건, 2페이지)")
	void historySortAcrossPages() throws Exception {
		for (int i = 1; i <= 25; i++) {
			history("202610150%02d".formatted(i), "20261015120000", "ACTAPI01", i * 10);
		}
		mvc.perform(get("/api/v1/trades/history?page=2&sort=amountAsc").cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(5)))
			.andExpect(jsonPath("$.data.items[0].amount").value(210))
			.andExpect(jsonPath("$.data.items[4].amount").value(250));
	}

	@Test
	@DisplayName("이력 필터: 잘못된 값은 400 (날짜 형식·from>to·금액 음수·min>max·q 101자·sort), 커서 방식에서 최신순 아닌 정렬도 400")
	void historyFilterValidation() throws Exception {
		mvc.perform(get("/api/v1/trades/history?page=1&from=2026-13-01").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.from").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&to=20261001").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.to").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&from=2026-10-10&to=2026-10-09").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.from").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&minAmount=-1").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.minAmount").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&maxAmount=2147483648").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.maxAmount").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&minAmount=500&maxAmount=100").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.minAmount").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&q=" + "가".repeat(101)).cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.q").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&sort=x").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.sort").exists());
		mvc.perform(get("/api/v1/trades/history?page=1&field=prodNo&q=a").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.field").exists());
		mvc.perform(get("/api/v1/trades/history?sort=oldest").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.sort").exists());
		mvc.perform(get("/api/v1/trades/history?q=R740").cookie(buyer)).andExpect(status().isOk());
		mvc.perform(get("/api/v1/trades/history?page=1&q=" + "가".repeat(100)).cookie(buyer)).andExpect(status().isOk());
		mvc.perform(get("/api/v1/trades/history?page=1&maxAmount=2147483647").cookie(buyer)).andExpect(status().isOk());
	}

	// ---- 내 활동내역: 진행 중만 ----

	@Test
	@DisplayName("active=true: 구매자는 견적요청·견적수락·견적거절·구매요청만, 판매자는 견적요청·구매요청만. 구매확정은 뺀다")
	void activeStatesOnly() throws Exception {
		String confirmed = buy(buyerId, REG_A, 1);
		complete(buyer, confirmed);
		String requested = buy(buyerId, REG_B, 1);
		// 견적수락·견적거절 상태 행을 직접 만든다 (구매자 화면에는 보이고 판매자 화면에는 안 보여야 한다)
		jdbc.update("update trd_trade_info set trade_stats = '견적수락', trade_type = '견적조정' where trade_id = ?", requested);

		mvc.perform(get("/api/v1/trades?role=buyer").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(2)));
		mvc.perform(get("/api/v1/trades?role=buyer&active=true").cookie(buyer)).andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(requested));
		mvc.perform(get("/api/v1/trades?role=seller").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(2)));
		// 견적수락은 판매자가 이미 처리한 것 → 판매자 요청 탭에서 빠진다
		mvc.perform(get("/api/v1/trades?role=seller&active=true").cookie(seller)).andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	// ---- 활동내역 목록 검색·필터 (계획 2026-10-30 후속) ----

	@Test
	@DisplayName("목록 필터: 상품명 부분 일치(구매자·판매자 둘 다), 없는 이름은 빈 결과, 남의 거래는 안 보인다")
	void tradeListFilterByName() throws Exception {
		buy(buyerId, REG_A, 1); // 서버 R740
		buy(buyerId, REG_B, 1); // 스위치 C9300
		for (var who : new Cookie[] { buyer, seller }) {
			String role = who == buyer ? "buyer" : "seller";
			mvc.perform(get("/api/v1/trades?role=" + role + "&active=true&page=1").param("q", "r740").cookie(who))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.total").value(1))
				.andExpect(jsonPath("$.data.items", hasSize(1)))
				.andExpect(jsonPath("$.data.items[0].prodName").value("서버 R740"));
		}
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1").param("q", "없는이름").cookie(buyer))
			.andExpect(jsonPath("$.data.items", hasSize(0))).andExpect(jsonPath("$.data.totalPages").value(1));
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1").param("q", "%").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(0));
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1").param("q", "r740").cookie(stranger))
			.andExpect(jsonPath("$.data.total").value(0));
		// 검색 구분 — 이력과 같은 규칙
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&q=cisco").cookie(buyer)).andExpect(jsonPath("$.data.total").value(1));
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&field=name&q=cisco").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(0));
		mvc.perform(get("/api/v1/trades?role=seller&active=true&page=1&field=brand&q=dell").cookie(seller))
			.andExpect(jsonPath("$.data.total").value(1));
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&field=x&q=a").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.field").exists());
	}

	@Test
	@DisplayName("목록 필터: 상태는 그 목록에서 보일 수 있는 진행 중 상태 안에서만 (판매자에게 견적수락은 없다)")
	void tradeListFilterByStatus() throws Exception {
		String requested = buy(buyerId, REG_A, 1);
		String accepted = buy(buyerId, REG_B, 1);
		jdbc.update("update trd_trade_info set trade_stats = '견적수락', trade_type = '견적조정' where trade_id = ?", accepted);
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&status=quoteAccepted").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.items[0].tradeId").value(accepted));
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&status=requested").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.items[0].tradeId").value(requested));
		mvc.perform(get("/api/v1/trades?role=seller&active=true&page=1&status=requested").cookie(seller))
			.andExpect(jsonPath("$.data.total").value(1));
		// 판매자 진행 중 상태가 아니거나 모르는 값, 진행 중이 아닌 구매확정은 400
		mvc.perform(get("/api/v1/trades?role=seller&active=true&page=1&status=quoteAccepted").cookie(seller))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.status").exists());
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&status=confirmed").cookie(buyer))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.status").exists());
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&page=1&status=x").cookie(buyer))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.status").exists());
	}

	@Test
	@DisplayName("목록 필터: 기간(양끝 포함)·금액 범위(단가×수량)·정렬 4종, 같은 금액이면 최신 먼저")
	void tradeListFilterByPeriodAmountAndSort() throws Exception {
		String small = buy(buyerId, REG_A, 1); // 1,000원
		String mid = buy(buyerId, REG_A, 3); // 3,000원
		String big = buy(buyerId, REG_B, 5); // 5,000원
		String midTwin = buy(buyerId, REG_B, 3); // 3,000원
		jdbc.update("update trd_trade_info set reg_date = '20261001090000' where trade_id = ?", small);
		jdbc.update("update trd_trade_info set reg_date = '20261005235959' where trade_id = ?", mid);
		jdbc.update("update trd_trade_info set reg_date = '20261010000000' where trade_id = ?", big);
		jdbc.update("update trd_trade_info set reg_date = '20261010000000' where trade_id = ?", midTwin);
		String base = "/api/v1/trades?role=buyer&active=true&page=1";

		mvc.perform(get(base + "&from=2026-10-05&to=2026-10-05").cookie(buyer)).andExpect(jsonPath("$.data.total").value(1))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(mid));
		mvc.perform(get(base + "&from=2026-10-02").cookie(buyer)).andExpect(jsonPath("$.data.total").value(3));
		mvc.perform(get(base + "&minAmount=3000&maxAmount=3000").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
		mvc.perform(get(base + "&minAmount=3001").cookie(buyer)).andExpect(jsonPath("$.data.total").value(1));

		mvc.perform(get(base).cookie(buyer)).andExpect(jsonPath("$.data.items[0].tradeId").value(midTwin));
		mvc.perform(get(base + "&sort=oldest").cookie(buyer)).andExpect(jsonPath("$.data.items[0].tradeId").value(small));
		mvc.perform(get(base + "&sort=amountDesc").cookie(buyer))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(big))
			.andExpect(jsonPath("$.data.items[1].tradeId").value(midTwin))
			.andExpect(jsonPath("$.data.items[2].tradeId").value(mid));
		mvc.perform(get(base + "&sort=amountAsc").cookie(buyer))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(small))
			.andExpect(jsonPath("$.data.items[3].tradeId").value(big));
	}

	@Test
	@DisplayName("목록 필터: 잘못된 값은 400 (날짜·기간 뒤집힘·금액·q 101자·sort), 커서 방식에서 최신순 아닌 정렬도 400")
	void tradeListFilterValidation() throws Exception {
		String base = "/api/v1/trades?role=buyer&active=true&page=1";
		mvc.perform(get(base + "&from=2026-13-01").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.from").exists());
		mvc.perform(get(base + "&from=2026-10-10&to=2026-10-09").cookie(buyer)).andExpect(status().isBadRequest());
		mvc.perform(get(base + "&minAmount=-1").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.minAmount").exists());
		mvc.perform(get(base + "&minAmount=500&maxAmount=100").cookie(buyer)).andExpect(status().isBadRequest());
		mvc.perform(get(base).param("q", "가".repeat(101)).cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.q").exists());
		mvc.perform(get(base + "&sort=x").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.sort").exists());
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&sort=oldest").cookie(buyer)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.sort").exists());
		// 커서 방식도 최신순이면 필터는 받는다
		mvc.perform(get("/api/v1/trades?role=buyer&active=true&minAmount=1").cookie(buyer)).andExpect(status().isOk());
	}

	// ---- 내 구매 매물 검색 ----

	@Test
	@DisplayName("내 구매 검색: 거래한 매물(진행 중·구매확정)만, 장바구니만 담은 매물·남의 거래는 제외")
	void purchasedListings() throws Exception {
		String tradeId = buy(buyerId, REG_A, 1);
		addToCart(buyer, REG_B);
		mvc.perform(get("/api/v1/trades/listings").cookie(buyer)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.total").value(1))
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].regDate").value(REG_A));
		complete(buyer, tradeId);
		mvc.perform(get("/api/v1/trades/listings").cookie(buyer)).andExpect(jsonPath("$.data.total").value(1));
		mvc.perform(get("/api/v1/trades/listings").cookie(stranger)).andExpect(jsonPath("$.data.total").value(0))
			.andExpect(jsonPath("$.data.items", hasSize(0)));
	}

	@Test
	@DisplayName("내 구매 검색: 같은 필터가 거래한 매물 안에서만 걸리고, 한 매물을 두 번 사도 한 줄")
	void purchasedListingsFilter() throws Exception {
		buy(buyerId, REG_A, 1);
		buy(buyerId, REG_B, 1);
		mvc.perform(get("/api/v1/trades/listings?q=스위치").cookie(buyer))
			.andExpect(jsonPath("$.data.total").value(1))
			.andExpect(jsonPath("$.data.items[0].regDate").value(REG_B));
		mvc.perform(get("/api/v1/trades/listings?q=없는이름").cookie(buyer)).andExpect(jsonPath("$.data.total").value(0));
		buy(buyerId, REG_A, 1);
		mvc.perform(get("/api/v1/trades/listings").cookie(buyer)).andExpect(jsonPath("$.data.total").value(2));
	}

}
