package com.company.market.listing.controller;

import java.util.stream.IntStream;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.service.ProductService;
import com.company.market.listing.service.ProductService.ProductDraft;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 상품마스터 검색 API(필터·페이지 번호) (계획 2026-11-09-product-search-modal.md 작업 2) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductSearchPageApiTest {

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
	ProductService products;

	Cookie authCookie;

	@BeforeEach
	void setUp() {
		cleanUp();
		String userId = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("prodpageapi")
			.passwordHash("$2a$12$hash").nickname("prodpageapi").email("prodpageapi@example.com")
			.name("홍길동").phone("01077770127").phoneHash(hasher.hash("01077770127")).build()).getId();
		authCookie = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(userId));
		IntStream.rangeClosed(1, 25).forEach(i -> products.findOrCreate(new ProductDraft(CategoryFragments.parse("P01-Q01-R001"),
				"검색API %02d".formatted(i), null, "SrchApiBrand", null, null, null, null, null, null, null)));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_master where prod_brand like 'SrchApiBrand%'");
		jdbc.update("delete from trd_user_info where user_id = 'prodpageapi'");
	}

	@Test
	@DisplayName("필터와 페이지: 제조사로 가두면 25건이 20 + 5 로 나뉜다")
	void pagesAndFilters() throws Exception {
		mvc.perform(get("/api/v1/products/page").param("brand", "SrchApiBrand").cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.total").value(25))
			.andExpect(jsonPath("$.data.totalPages").value(2))
			.andExpect(jsonPath("$.data.page").value(1))
			.andExpect(jsonPath("$.data.items", hasSize(20)))
			.andExpect(jsonPath("$.data.items[0].prodName").value("검색API 01"))
			.andExpect(jsonPath("$.data.items[0].listingCount").value(0))
			.andExpect(content().string(not(containsString("prodpageapi@example.com"))));

		mvc.perform(get("/api/v1/products/page").param("brand", "SrchApiBrand").param("page", "2").cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(5)));

		mvc.perform(get("/api/v1/products/page").param("q", "검색API 07").param("category", "P01").param("brand", "SrchApiBrand").cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.total").value(1))
			.andExpect(jsonPath("$.data.items[0].prodName").value("검색API 07"));
	}

	@Test
	@DisplayName("로그인 없이는 401")
	void unauthenticated() throws Exception {
		mvc.perform(get("/api/v1/products/page")).andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("잘못된 입력은 400 + fields: 검색어·제조사 51자, 카테고리 형식, page 0·범위 밖·숫자 아님")
	void invalidInput() throws Exception {
		String tooLong = "가".repeat(51);
		mvc.perform(get("/api/v1/products/page").param("q", tooLong).cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.q").exists());
		mvc.perform(get("/api/v1/products/page").param("brand", tooLong).cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.brand").exists());
		mvc.perform(get("/api/v1/products/page").param("category", "ZZZZZZ").cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.category").exists());
		mvc.perform(get("/api/v1/products/page").param("page", "0").cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.page").exists());
		mvc.perform(get("/api/v1/products/page").param("brand", "SrchApiBrand").param("page", "3").cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.page").exists());
		mvc.perform(get("/api/v1/products/page").param("page", "abc").cookie(authCookie))
			.andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("기존 검색(GET /api/v1/products?q=)은 그대로 최대 10건")
	void legacySearchUnchanged() throws Exception {
		mvc.perform(get("/api/v1/products").param("q", "검색API").cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data", hasSize(10)));
	}

}
