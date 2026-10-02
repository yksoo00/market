package com.company.market.listing.controller;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.domain.UserRole;
import com.company.market.user.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 매물 목록 검색·필터 (스펙 docs/superpowers/specs/2026-10-02-search-api-design.md).
 * 데이터는 등록 API 대신 repository 로 직접 만든다 — 등록 입력 규칙이 바뀌어도 검색 조건만 검증하게.
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingSearchApiTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	ListingRepository listingRepository;

	@Autowired
	ProductRepository productRepository;

	@Autowired
	JwtProvider jwtProvider;

	@Autowired
	RateLimiter limiter;

	UUID userId;

	@BeforeEach
	void setUp() {
		jdbc.update("delete from listings");
		jdbc.update("delete from products");
		jdbc.update("delete from users where role <> 'admin'");
		User user = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("searchtester")
			.passwordHash("$2a$12$hash").nickname("searchtester").email("searchtester@example.com")
			.name("홍길동").phone("01012340000").phoneHash(hasher.hash("01012340000")).build());
		userId = user.getId();
		// 비로그인 검색은 IP(MockMvc 는 127.0.0.1) 분당 60 — 테스트끼리 카운터가 쌓이지 않게
		limiter.reset(SEARCH_LIMIT_KEY);
	}

	// 다른 테스트 클래스에 흔적을 남기지 않는다: 매물이 남으면 그쪽의 "사용자 전체 삭제"가 FK 로 실패하고,
	// 카운터가 남으면 ListingApiTest 의 비로그인 목록 호출이 429 에 걸린다
	@AfterEach
	void cleanUp() {
		jdbc.update("delete from listings");
		jdbc.update("delete from products");
		jdbc.update("delete from users where role <> 'admin'");
		limiter.reset(SEARCH_LIMIT_KEY);
	}

	private static final String SEARCH_LIMIT_KEY = "listing:search:ip:127.0.0.1";

	private void expectInvalid(String field, String... params) throws Exception {
		MockHttpServletRequestBuilder req = get("/api/v1/listings");
		for (int i = 0; i < params.length; i += 2) {
			req.param(params[i], params[i + 1]);
		}
		mvc.perform(req)
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.fields." + field).isString());
	}

	@Test
	@DisplayName("범위 밖·형식 오류 파라미터는 400 VALIDATION 과 해당 필드")
	void outOfRangeParamsAre400() throws Exception {
		expectInvalid("minStock", "minStock", "100001");
		expectInvalid("minPrice", "minPrice", "-1");
		expectInvalid("maxPrice", "maxPrice", "1000000001");
		expectInvalid("q", "q", "가".repeat(101));
		expectInvalid("field", "field", "foo");
		expectInvalid("status", "status", "foo");
		expectInvalid("deliveryBy", "deliveryBy", "2026-13-01");
	}

	@Test
	@DisplayName("검색어 100자는 앞뒤 공백을 뺀 길이로 센다")
	void queryLengthCountsAfterTrim() throws Exception {
		mvc.perform(get("/api/v1/listings").param("q", "  " + "가".repeat(100) + "  ")).andExpect(status().isOk());
	}

	@Test
	@DisplayName("최소 가격이 최대 가격보다 크면 400, 오류는 maxPrice 에")
	void minPriceOverMaxIs400() throws Exception {
		expectInvalid("maxPrice", "minPrice", "10", "maxPrice", "5");
	}

	@Test
	@DisplayName("비로그인 검색은 IP 분당 60회, 61번째는 429")
	void anonymousSearchIsRateLimited() throws Exception {
		for (int i = 0; i < 60; i++) {
			mvc.perform(get("/api/v1/listings")).andExpect(status().isOk());
		}
		mvc.perform(get("/api/v1/listings"))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
	}

	@Test
	@DisplayName("로그인 사용자 검색은 제한하지 않는다")
	void loggedInSearchIsNotRateLimited() throws Exception {
		Cookie auth = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(userId, UserRole.USER));
		for (int i = 0; i < 61; i++) {
			mvc.perform(get("/api/v1/listings").cookie(auth)).andExpect(status().isOk());
		}
	}

	private void save(String prodId, String regDate, String name, String prodNo, String brand, int price, int stock,
			String deliveryDate) {
		productRepository.saveAndFlush(Product.builder().prodId(prodId).categoryCode("ELEC0001").prodName(name)
			.prodNo(prodNo).prodBrand(brand).regDate(regDate).build());
		listingRepository.saveAndFlush(Listing.builder().userId(userId).regDate(regDate).prodId(prodId).tradeType("등록")
			.prodState("양호").salesUnitPrice(price).salesQuantity(Math.max(stock, 1)).minOrderQuantity(1).orderUnit(1)
			.stockQuantity(stock).deliveryDate(deliveryDate).build());
	}

	/** 10-01 검색 결과 프론트 필터 테스트(lib/search.test.ts)의 사례를 옮긴 4건. 최신순 = A, B, C, D */
	private void saveFour() {
		save("ELEC00010001", "20261001090004", "LM324AD", "LM324AD", "STMICROELECTRONICS", 320, 500, "2026-10-08");
		save("ELEC00010002", "20261001090003", "PowerEdge R740 2U", "R740-4210", "Dell", 3_500_000, 2, "2026-10-15");
		save("ELEC00010003", "20261001090002", "Catalyst 9300 48P PoE+", "C9300-48P-E", "Cisco", 1_900_000, 30, null);
		save("ELEC00010004", "20261001090001", "A100 80GB PCIe", null, "NVIDIA", 18_500_000, 0, "2026-11-30");
		jdbc.update("update listings set dt_expire = '20261002100000' where reg_date = '20261001090001'");
	}

	private static final String A = "20261001090004";
	private static final String B = "20261001090003";
	private static final String C = "20261001090002";
	private static final String D = "20261001090001";

	/** "이름", "값" 쌍으로 파라미터를 받는다. URL 문자열에 끼우면 MockMvc 가 %·공백을 한 번 더 인코딩해 다른 값을 검사하게 된다 */
	private List<String> regDates(String... params) throws Exception {
		MockHttpServletRequestBuilder req = get("/api/v1/listings");
		for (int i = 0; i < params.length; i += 2) {
			req.param(params[i], params[i + 1]);
		}
		String body = mvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		return JsonPath.read(body, "$.data.items[*].regDate");
	}

	@Test
	@DisplayName("파라미터 없는 기존 호출은 전체를 최신순으로, total 과 함께")
	void noParamsKeepsPreviousBehavior() throws Exception {
		saveFour();
		assertThat(regDates()).containsExactly(A, B, C, D);
		mvc.perform(get("/api/v1/listings")).andExpect(jsonPath("$.data.total").value(4));
	}

	@Test
	@DisplayName("검색어는 공백으로 나눈 낱말이 모두 들어 있어야 하고 순서는 무관")
	void multipleWordsAllMustMatch() throws Exception {
		saveFour();
		assertThat(regDates("q", "48p catalyst")).containsExactly(C);
		assertThat(regDates("q", "R740  poweredge")).containsExactly(B);
		assertThat(regDates("q", "catalyst R740")).isEmpty();
	}

	@Test
	@DisplayName("검색어는 대소문자를 무시한다")
	void caseInsensitive() throws Exception {
		saveFour();
		assertThat(regDates("q", "lm324")).containsExactly(A);
	}

	@Test
	@DisplayName("field 로 검색 범위가 바뀐다 (name=상품명+상품번호, brand=제조사, all=셋 다)")
	void fieldScopes() throws Exception {
		saveFour();
		assertThat(regDates("field", "name", "q", "dell")).isEmpty();
		assertThat(regDates("field", "name", "q", "per7")).isEmpty();
		assertThat(regDates("field", "name", "q", "r740-4210")).containsExactly(B);
		assertThat(regDates("field", "brand", "q", "dell")).containsExactly(B);
		assertThat(regDates("field", "brand", "q", "PowerEdge")).isEmpty();
		assertThat(regDates("field", "all", "q", "Dell R740")).containsExactly(B);
	}

	@Test
	@DisplayName("검색어의 % _ 는 와일드카드가 아니라 글자 그대로")
	void likeWildcardsAreLiteral() throws Exception {
		saveFour();
		save("ELEC00010005", "20261001090005", "A_B 메모리 50%", null, "Samsung", 1000, 1, null);
		// 이스케이프하지 않으면 % 는 모든 문자열, _ 는 아무 한 글자와 맞아 5건 전부가 나온다
		assertThat(regDates("q", "%")).containsExactly("20261001090005");
		assertThat(regDates("q", "_")).containsExactly("20261001090005");
		assertThat(regDates("q", "\\")).isEmpty();
	}

	@Test
	@DisplayName("공백만 있는 검색어는 조건 없음")
	void blankQueryMeansNoCondition() throws Exception {
		saveFour();
		assertThat(regDates("q", "   ")).containsExactly(A, B, C, D);
	}

	@Test
	@DisplayName("거래상태: available 은 거래완료 제외, completed 는 거래완료만, all 은 전체")
	void statusFilter() throws Exception {
		saveFour();
		assertThat(regDates("status", "available")).containsExactly(A, B, C);
		assertThat(regDates("status", "completed")).containsExactly(D);
		assertThat(regDates("status", "all")).containsExactly(A, B, C, D);
	}

	@Test
	@DisplayName("가격 범위·재고·납품일(납기일 없는 매물은 제외)")
	void priceStockDelivery() throws Exception {
		saveFour();
		assertThat(regDates("minPrice", "320", "maxPrice", "1900000")).containsExactly(A, C);
		assertThat(regDates("minPrice", "1900001")).containsExactly(B, D);
		assertThat(regDates("maxPrice", "320")).containsExactly(A);
		assertThat(regDates("minStock", "10")).containsExactly(A, C);
		assertThat(regDates("deliveryBy", "2026-10-10")).containsExactly(A);
		assertThat(regDates("deliveryBy", "2026-12-31")).containsExactly(A, B, D);
	}

	@Test
	@DisplayName("total 은 페이지와 무관한 전체 개수")
	void totalIgnoresPaging() throws Exception {
		for (int i = 0; i < 21; i++) {
			save(String.format("ELEC0001%04d", i), String.format("202610010900%02d", i), "노트북 " + i, null, "삼성", 1000,
					1, null);
		}
		mvc.perform(get("/api/v1/listings").param("q", "노트북"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items.length()").value(20))
			.andExpect(jsonPath("$.data.total").value(21))
			.andExpect(jsonPath("$.data.nextCursor").isString());
	}

	@Test
	@DisplayName("필터를 건 채 다음 페이지를 받아도 중복·누락이 없다")
	void filteredCursorPagesHaveNoGapOrDuplicate() throws Exception {
		for (int i = 0; i < 25; i++) {
			save(String.format("ELEC0001%04d", i), String.format("202610010900%02d", i), "서버 " + i, null, "Dell",
					1000 + i, 1, null);
		}
		// 가격 필터에 걸리지 않는 매물 하나 — 다음 페이지에 섞여 들어오면 안 된다
		save("ELEC00019999", "20261001090030", "서버 비쌈", null, "Dell", 999_999, 1, null);

		String first = mvc.perform(get("/api/v1/listings").param("maxPrice", "2000")).andReturn().getResponse()
			.getContentAsString();
		String cursor = JsonPath.read(first, "$.data.nextCursor");
		String second = mvc.perform(get("/api/v1/listings").param("maxPrice", "2000").param("cursor", cursor)).andReturn()
			.getResponse().getContentAsString();

		List<String> all = new ArrayList<>(JsonPath.<List<String>>read(first, "$.data.items[*].regDate"));
		all.addAll(JsonPath.<List<String>>read(second, "$.data.items[*].regDate"));
		Set<String> unique = new HashSet<>(all);
		assertThat(all).hasSize(25);
		assertThat(unique).hasSize(25).doesNotContain("20261001090030");
		assertThat(JsonPath.<Object>read(second, "$.data.nextCursor")).isNull();
	}

	@Test
	@DisplayName("같은 등록일시의 다른 사용자 매물이 페이지 경계에 걸쳐도 다음 페이지에서 소실되지 않는다")
	void tiedRegDateAtPageBoundaryIsNotLost() throws Exception {
		// 19건으로 1페이지 대부분을 채우고, 같은 초에 등록한 3명 중 2명만 1페이지에 들어가게 한다
		for (int i = 1; i <= 19; i++) {
			save(String.format("ELEC0001%04d", i), String.format("202610010901%02d", i), "부품 " + i, null, "삼성", 1000, 1,
					null);
		}
		String tieDate = "20261001090100";
		productRepository.saveAndFlush(Product.builder().prodId("ELEC00019000").categoryCode("ELEC0001").prodName("부품 동률")
			.prodBrand("삼성").regDate(tieDate).build());
		for (String loginId : List.of("searchtieb", "searchtiec")) {
			UUID other = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
				.nickname(loginId).email(loginId + "@example.com").name("김철수")
				.phone(loginId.equals("searchtieb") ? "01099998888" : "01077776666")
				.phoneHash(hasher.hash(loginId.equals("searchtieb") ? "01099998888" : "01077776666")).build()).getId();
			listingRepository.saveAndFlush(Listing.builder().userId(other).regDate(tieDate).prodId("ELEC00019000")
				.tradeType("등록").prodState("양호").salesUnitPrice(1000).salesQuantity(1).minOrderQuantity(1).orderUnit(1)
				.build());
		}
		listingRepository.saveAndFlush(Listing.builder().userId(userId).regDate(tieDate).prodId("ELEC00019000")
			.tradeType("등록").prodState("양호").salesUnitPrice(1000).salesQuantity(1).minOrderQuantity(1).orderUnit(1)
			.build());

		String first = mvc.perform(get("/api/v1/listings")).andReturn().getResponse().getContentAsString();
		String second = mvc.perform(get("/api/v1/listings").param("cursor", JsonPath.<String>read(first, "$.data.nextCursor")))
			.andReturn().getResponse().getContentAsString();

		// 옛 "reg_date < cursor" 방식이면 동률 그룹의 세 번째 사용자가 영구히 사라진다
		List<String> tiedUsers = new ArrayList<>(JsonPath.<List<String>>read(first, "$.data.items[?(@.regDate == '" + tieDate + "')].userId"));
		tiedUsers.addAll(JsonPath.<List<String>>read(second, "$.data.items[?(@.regDate == '" + tieDate + "')].userId"));
		assertThat(tiedUsers).hasSize(3).doesNotHaveDuplicates();
	}

	@Test
	@DisplayName("검색 결과 한 줄은 프론트 ListingSearchItem 모양")
	void itemShape() throws Exception {
		saveFour();
		mvc.perform(get("/api/v1/listings").param("q", "LM324AD"))
			.andExpect(jsonPath("$.data.items[0].userId").value(userId.toString()))
			.andExpect(jsonPath("$.data.items[0].prodNo").value("LM324AD"))
			.andExpect(jsonPath("$.data.items[0].prodBrand").value("STMICROELECTRONICS"))
			.andExpect(jsonPath("$.data.items[0].category").value("ELEC0001"))
			.andExpect(jsonPath("$.data.items[0].hasDataSheet").value(false))
			.andExpect(jsonPath("$.data.items[0].hasPhoto").value(false))
			.andExpect(jsonPath("$.data.items[0].stockQuantity").value(500))
			.andExpect(jsonPath("$.data.items[0].salesUnitPrice").value(320))
			.andExpect(jsonPath("$.data.items[0].deliveryDate").value("2026-10-08"))
			.andExpect(jsonPath("$.data.items[0].tradeStatus").value("available"));
	}

}
