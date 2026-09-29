package com.company.market.listing.controller;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
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

import static org.assertj.core.api.Assertions.assertThat;
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

	Cookie authCookie;

	@BeforeEach
	void setUp() {
		jdbc.update("delete from listings");
		jdbc.update("delete from products");
		jdbc.update("delete from users where role <> 'admin'");

		User user = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("listingapitester")
			.passwordHash("$2a$12$hash").nickname("listingapitester").email("listingapitester@example.com")
			.name("홍길동").phone("01012345678").phoneHash(hasher.hash("01012345678")).build());
		String token = jwtProvider.createAccessToken(user.getId(), UserRole.USER);
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

}
