package com.company.market.trade.controller;

import com.company.market.TestUids;
import java.util.ArrayList;
import java.util.List;
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
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 받은 견적요청 한꺼번에 처리 API (계획 2026-11-03-quote-bulk-reply.md) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class QuoteBulkReplyApiTest {

	static final String REG_A = "20261103100000";

	static final String REG_B = "20261103100001";

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

	String buyer1Id;

	String buyer2Id;

	Cookie seller;

	Cookie buyer1;

	Cookie buyer2;

	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = newUser("bulkseller", "01044440001");
		buyer1Id = newUser("bulkbuyer1", "01044440002");
		buyer2Id = newUser("bulkbuyer2", "01044440003");
		seller = cookieOf(sellerId);
		buyer1 = cookieOf(buyer1Id);
		buyer2 = cookieOf(buyer2Id);
		listing(REG_A, "BULKAPI001", "서버 R740", 1000, 10);
		listing(REG_B, "BULKAPI002", "스위치 C9300", 500, 100);
	}

	@AfterEach
	void cleanUp() {
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

	private void listing(String regDate, String prodId, String name, int price, int stock) {
		productRepository.saveAndFlush(Product.builder().prodId(prodId).majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName(name).prodBrand("Dell").regDate(regDate).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(regDate).prodId(prodId)
			.tradeType("등록").prodState("신품").salesUnitPrice(price).salesQuantity(stock).stockQuantity(stock)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
	}

	/** 그 구매자가 견적을 보내고, 만들어진 거래ID 를 돌려준다 */
	private String quote(Cookie who, String whoId, String regDate, int price, int quantity) throws Exception {
		mvc.perform(post("/api/v1/trades/quotes").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"items":[{"sellerId":"%s","regDate":"%s","orderUnitPrice":%d,"orderQuantity":%d,"reqDeliDate":"2099-11-30"}]}
					""".formatted(sellerId, regDate, price, quantity))).andExpect(status().isCreated());
		return jdbc.queryForObject("select trade_id from trd_trade_info where user_id = ? and prod_reg_date = ? and trade_type = '견적조정'",
				String.class, whoId, regDate);
	}

	private ResultActions reply(Cookie who, String decision, String... tradeIds) throws Exception {
		List<String> quoted = new ArrayList<>();
		for (String id : tradeIds) {
			quoted.add("\"" + id + "\"");
		}
		return mvc.perform(post("/api/v1/trades/quote-requests/reply").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"tradeIds\":[%s],\"decision\":\"%s\"}".formatted(String.join(",", quoted), decision)));
	}

	private int stockOf(String regDate) {
		return jdbc.queryForObject("select stock_quantity from trd_prod_reg where reg_date = ?", Integer.class, regDate);
	}

	private String statsOf(String tradeId) {
		return jdbc.queryForObject("select trade_stats from trd_trade_info where trade_id = ?", String.class, tradeId);
	}

	@Test
	@DisplayName("목록: 내가 받은 견적요청 상태만 오래된 순으로, 매물의 지금 재고와 구매자 닉네임을 함께 — 남의 견적·처리된 견적은 안 나온다")
	void listsPendingQuotesOldestFirst() throws Exception {
		String first = quote(buyer1, buyer1Id, REG_A, 900, 6);
		String second = quote(buyer2, buyer2Id, REG_A, 900, 4);
		String third = quote(buyer1, buyer1Id, REG_B, 450, 2);
		String rejected = quote(buyer2, buyer2Id, REG_B, 450, 1);
		mvc.perform(post("/api/v1/trades/" + rejected + "/reject").cookie(seller)).andExpect(status().isOk());
		mvc.perform(get("/api/v1/trades/quote-requests").cookie(seller)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.total").value(3))
			.andExpect(jsonPath("$.data.items", hasSize(3)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value(first))
			.andExpect(jsonPath("$.data.items[1].tradeId").value(second))
			.andExpect(jsonPath("$.data.items[2].tradeId").value(third))
			.andExpect(jsonPath("$.data.items[0].prodName").value("서버 R740"))
			.andExpect(jsonPath("$.data.items[0].buyerNickname").value("bulkbuyer1"))
			.andExpect(jsonPath("$.data.items[0].orderQuantity").value(6))
			.andExpect(jsonPath("$.data.items[0].orderUnitPrice").value(900))
			.andExpect(jsonPath("$.data.items[0].salesUnitPrice").value(1000))
			.andExpect(jsonPath("$.data.items[0].stockQuantity").value(10))
			.andExpect(jsonPath("$.data.items[2].stockQuantity").value(100));
		// 남의 매물에 온 견적은 구매자(판매자 아님)에게 안 보인다
		mvc.perform(get("/api/v1/trades/quote-requests").cookie(buyer1)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.total").value(0)).andExpect(jsonPath("$.data.items", hasSize(0)));
		mvc.perform(get("/api/v1/trades/quote-requests")).andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("목록은 30건까지만 주고 total 은 전체 건수 — 오래된 것부터")
	void listIsCappedAtThirty() throws Exception {
		for (int i = 0; i < 31; i++) {
			String buyerId = TestUids.random();
			jdbc.update("""
					insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, reg_date, prod_id, order_unit_price,
						order_quantity, prov_date, req_deli_date, trade_stats)
					values (?, ?, '견적조정', ?, ?, ?, 'BULKAPI002', 450, 1, '2099-12-31', '2099-12-31', '견적요청')
					""", buyerId, "2611039%04d".formatted(i), sellerId, REG_B, "202611031000%02d".formatted(i));
		}
		mvc.perform(get("/api/v1/trades/quote-requests").cookie(seller)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.total").value(31))
			.andExpect(jsonPath("$.data.items", hasSize(30)))
			.andExpect(jsonPath("$.data.items[0].tradeId").value("26110390000"));
	}

	@Test
	@DisplayName("모두 수락: 합계가 재고 이내인 묶음은 전부 수락돼 재고가 묶인다")
	void acceptAllWithinStock() throws Exception {
		String a1 = quote(buyer1, buyer1Id, REG_A, 900, 6);
		String a2 = quote(buyer2, buyer2Id, REG_A, 900, 4);
		reply(seller, "accept", a1, a2).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results", hasSize(2)))
			.andExpect(jsonPath("$.data.results[0].tradeId").value(a1))
			.andExpect(jsonPath("$.data.results[0].ok").value(true))
			.andExpect(jsonPath("$.data.results[0].tradeStats").value("quoteAccepted"))
			.andExpect(jsonPath("$.data.results[1].ok").value(true));
		assertThat(statsOf(a1)).isEqualTo("견적수락");
		assertThat(statsOf(a2)).isEqualTo("견적수락");
		assertThat(stockOf(REG_A)).isZero();
		// 매물 단가는 안 바뀐다 (단건 수락과 같은 정책)
		assertThat(jdbc.queryForObject("select sales_unit_price from trd_prod_reg where reg_date = ?", Integer.class, REG_A)).isEqualTo(1000);
	}

	@Test
	@DisplayName("모두 수락: 한 묶음의 합계가 재고를 넘으면(6+6 > 10) 그 묶음은 통째로 실패하고 사유를 알리지만, 다른 묶음의 성공은 그대로 남는다")
	void groupOverStockFailsAsWholeButOthersSucceed() throws Exception {
		String a1 = quote(buyer1, buyer1Id, REG_A, 900, 6);
		String a2 = quote(buyer2, buyer2Id, REG_A, 900, 6);
		String b1 = quote(buyer1, buyer1Id, REG_B, 450, 2);
		reply(seller, "accept", a1, a2, b1).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(false))
			.andExpect(jsonPath("$.data.results[0].code").value("TRADE_OUT_OF_STOCK"))
			.andExpect(jsonPath("$.data.results[0].message", containsString("12")))
			.andExpect(jsonPath("$.data.results[0].message", containsString("10")))
			.andExpect(jsonPath("$.data.results[1].ok").value(false))
			.andExpect(jsonPath("$.data.results[1].code").value("TRADE_OUT_OF_STOCK"))
			.andExpect(jsonPath("$.data.results[2].ok").value(true));
		assertThat(statsOf(a1)).isEqualTo("견적요청");
		assertThat(statsOf(a2)).isEqualTo("견적요청");
		assertThat(statsOf(b1)).isEqualTo("견적수락");
		assertThat(stockOf(REG_A)).isEqualTo(10);
		assertThat(stockOf(REG_B)).isEqualTo(98);
		// 건별 수락은 되는 만큼만: 앞 건이 재고를 쓰면 뒤 건은 재고 부족
		mvc.perform(post("/api/v1/trades/" + a1 + "/accept").cookie(seller)).andExpect(status().isOk());
		mvc.perform(post("/api/v1/trades/" + a2 + "/accept").cookie(seller)).andExpect(status().isConflict());
		assertThat(stockOf(REG_A)).isEqualTo(4);
	}

	@Test
	@DisplayName("모두 거절: 재고와 상관없이 전부 거절되고 재고는 그대로")
	void rejectAll() throws Exception {
		String a1 = quote(buyer1, buyer1Id, REG_A, 900, 6);
		String a2 = quote(buyer2, buyer2Id, REG_A, 900, 6);
		reply(seller, "reject", a1, a2).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(true))
			.andExpect(jsonPath("$.data.results[0].tradeStats").value("quoteRejected"))
			.andExpect(jsonPath("$.data.results[1].ok").value(true));
		assertThat(statsOf(a1)).isEqualTo("견적거절");
		assertThat(statsOf(a2)).isEqualTo("견적거절");
		assertThat(stockOf(REG_A)).isEqualTo(10);
	}

	@Test
	@DisplayName("그 사이 구매자가 취소했거나 이미 처리된 견적은 '이미 처리된 견적'(TRADE_NOT_PENDING)으로 빠지고 나머지는 처리된다")
	void alreadyHandledOrCanceledIsReportedPerItem() throws Exception {
		String canceled = quote(buyer1, buyer1Id, REG_A, 900, 2);
		String handled = quote(buyer2, buyer2Id, REG_A, 900, 3);
		String open = quote(buyer1, buyer1Id, REG_B, 450, 5);
		mvc.perform(post("/api/v1/trades/" + canceled + "/cancel").cookie(buyer1)).andExpect(status().isNoContent());
		mvc.perform(post("/api/v1/trades/" + handled + "/reject").cookie(seller)).andExpect(status().isOk());
		reply(seller, "accept", canceled, handled, open).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(false))
			.andExpect(jsonPath("$.data.results[0].code").value("TRADE_NOT_FOUND"))
			.andExpect(jsonPath("$.data.results[1].code").value("TRADE_NOT_PENDING"))
			.andExpect(jsonPath("$.data.results[1].message").value("이미 처리된 견적입니다."))
			.andExpect(jsonPath("$.data.results[2].ok").value(true));
		assertThat(stockOf(REG_A)).isEqualTo(10);
		assertThat(stockOf(REG_B)).isEqualTo(95);
	}

	@Test
	@DisplayName("남의 견적·없는 거래ID 는 그 건만 TRADE_NOT_FOUND — 구매자가 자기 견적으로 불러도 처리되지 않는다")
	void notMineIsNotFound() throws Exception {
		String mineToHandle = quote(buyer1, buyer1Id, REG_B, 450, 2);
		// 구매자 본인은 판매자가 아니라 처리할 수 없다 (존재도 알리지 않는다)
		reply(buyer1, "accept", mineToHandle).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(false))
			.andExpect(jsonPath("$.data.results[0].code").value("TRADE_NOT_FOUND"));
		assertThat(statsOf(mineToHandle)).isEqualTo("견적요청");
		reply(seller, "accept", "NOPE1234567", mineToHandle).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].code").value("TRADE_NOT_FOUND"))
			.andExpect(jsonPath("$.data.results[1].ok").value(true));
	}

	@Test
	@DisplayName("거래완료 매물의 견적은 수락할 수 없다(LISTING_COMPLETED) — 거절은 된다")
	void completedListing() throws Exception {
		String q = quote(buyer1, buyer1Id, REG_B, 450, 2);
		String r = quote(buyer2, buyer2Id, REG_B, 450, 3);
		jdbc.update("update trd_prod_reg set dt_expire = '20261103000000', stock_quantity = 0 where reg_date = ?", REG_B);
		reply(seller, "accept", q).andExpect(jsonPath("$.data.results[0].code").value("LISTING_COMPLETED"));
		assertThat(statsOf(q)).isEqualTo("견적요청");
		reply(seller, "reject", r).andExpect(jsonPath("$.data.results[0].ok").value(true));
	}

	@Test
	@DisplayName("같은 거래ID 를 두 번 보내도 한 번만 처리되고 결과도 한 줄")
	void duplicateIdsAreProcessedOnce() throws Exception {
		String a = quote(buyer1, buyer1Id, REG_A, 900, 6);
		reply(seller, "accept", a, a).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results", hasSize(1)))
			.andExpect(jsonPath("$.data.results[0].ok").value(true));
		assertThat(stockOf(REG_A)).isEqualTo(4);
	}

	@Test
	@DisplayName("잘못된 입력: 0개·31개·decision 오류는 400, 로그인 없으면 401")
	void invalidInput() throws Exception {
		reply(seller, "accept").andExpect(status().isBadRequest());
		String[] ids = new String[31];
		for (int i = 0; i < ids.length; i++) {
			ids[i] = "ID" + i;
		}
		reply(seller, "accept", ids).andExpect(status().isBadRequest());
		reply(seller, "maybe", "X1").andExpect(status().isBadRequest());
		mvc.perform(post("/api/v1/trades/quote-requests/reply").contentType(MediaType.APPLICATION_JSON)
			.content("{\"tradeIds\":[\"X1\"],\"decision\":\"accept\"}")).andExpect(status().isUnauthorized());
	}

}
