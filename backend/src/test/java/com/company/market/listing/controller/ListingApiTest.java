package com.company.market.listing.controller;

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
import com.company.market.user.domain.UserRole;
import com.company.market.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
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
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 매물 직접입력 등록. 인증은 access_token 쿠키(JwtAuthenticationFilter 는 쿠키만 읽음 — Authorization 헤더는 안 봄) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingApiTest {

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

	Cookie authCookie;

	UUID userId;

	@BeforeEach
	void setUp() {
		jdbc.update("delete from listings");
		jdbc.update("delete from products");
		jdbc.update("delete from users where role <> 'admin'");

		User user = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("listingapitester")
			.passwordHash("$2a$12$hash").nickname("listingapitester").email("listingapitester@example.com")
			.name("홍길동").phone("01012345678").phoneHash(hasher.hash("01012345678")).build());
		userId = user.getId();
		String token = jwtProvider.createAccessToken(userId, UserRole.USER);
		authCookie = new Cookie(AuthCookies.ACCESS, token);
	}

	@Test
	@DisplayName("직접입력으로 등록하면 없던 상품마스터가 자동 생성되고, 대표사진은 등록한 첫 사진이다")
	void createsListingAndAutoCreatesProduct() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 X","prodBrand":"삼성",
					 "tradeType":"등록","prodState":"new","salesUnitPrice":500000,"salesQuantity":3,
					 "photos":["p1.jpg","p2.jpg"]}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.ok").value(true))
			.andExpect(jsonPath("$.data.prodId").value("ELEC00010001"))
			.andExpect(jsonPath("$.data.photos[0]").value("p1.jpg"));

		assertThat(jdbc.queryForObject("select prod_photo_1 from products where prod_id = 'ELEC00010001'", String.class)).isEqualTo("p1.jpg");
	}

	@Test
	@DisplayName("가격이 10억을 넘으면 400 VALIDATION, fields.salesUnitPrice")
	void priceOverLimit() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 Y","prodBrand":"삼성",
					 "tradeType":"등록","prodState":"new","salesUnitPrice":2000000000,"salesQuantity":1}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.salesUnitPrice").isString());
	}

	@Test
	@DisplayName("로그인 없이 등록하면 401")
	void requiresAuth() throws Exception {
		mvc.perform(post("/api/v1/listings").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("사진 없이 등록해도 되고(0장), 4장 전부 채워도 된다")
	void photosBoundary() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 Z1","prodBrand":"삼성",
					 "tradeType":"등록","prodState":"new","salesUnitPrice":1000,"salesQuantity":1}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.photos.length()").value(0));

		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 Z2","prodBrand":"삼성",
					 "tradeType":"등록","prodState":"new","salesUnitPrice":1000,"salesQuantity":1,
					 "photos":["a.jpg","b.jpg","c.jpg","d.jpg"]}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.photos.length()").value(4));
	}

	@Test
	@DisplayName("등록한 매물을 상세 조회하면 그대로 나온다")
	void getReturnsCreatedListing() throws Exception {
		MvcResult created = mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 G","prodBrand":"삼성",
					 "tradeType":"등록","prodState":"new","salesUnitPrice":1000,"salesQuantity":1}
					"""))
			.andExpect(status().isCreated()).andReturn();
		String regDate = created.getResponse().getContentAsString().replaceAll(".*\"regDate\":\"([^\"]+)\".*", "$1");

		mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.prodName").value("노트북 G"));
	}

	@Test
	@DisplayName("존재하지 않는 매물 조회는 404 LISTING_NOT_FOUND")
	void getMissingIsNotFound() throws Exception {
		mvc.perform(get("/api/v1/listings/" + UUID.randomUUID() + "/20260101000000"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("LISTING_NOT_FOUND"));
	}

	@Test
	@DisplayName("형식이 깨진 커서는 500이 아니라 빈 목록/200으로 처리된다")
	void malformedCursorDoesNotCrash() throws Exception {
		mvc.perform(get("/api/v1/listings").param("cursor", "not-a-date"))
			.andExpect(status().isOk());
	}

	@Test
	@DisplayName("목록은 등록일시 내림차순, 21번째부터는 nextCursor로 다음 페이지")
	void listIsCursorPaginated() throws Exception {
		Product product = productRepository.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
			.prodName("노트북 목록용").prodBrand("삼성").regDate("20260929120000").build());
		for (int i = 0; i < 21; i++) {
			String regDate = String.format("202609291200%02d", i);
			listingRepository.saveAndFlush(Listing.builder().userId(userId).regDate(regDate).prodId(product.getProdId())
				.tradeType("등록").prodState("new").salesUnitPrice(1000).salesQuantity(1)
				.minOrderQuantity(1).orderUnit(1).build());
		}

		mvc.perform(get("/api/v1/listings"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items.length()").value(20))
			.andExpect(jsonPath("$.data.nextCursor").isString())
			.andExpect(jsonPath("$.data.items[0].regDate").value("202609291200" + String.format("%02d", 20)));
	}

}
