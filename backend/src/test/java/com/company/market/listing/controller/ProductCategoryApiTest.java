package com.company.market.listing.controller;

import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ProductRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 등록 폼이 쓰는 상품마스터 검색·카테고리 목록 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductCategoryApiTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	ProductRepository products;

	@Autowired
	JwtProvider jwtProvider;

	/** 쿠키 인증은 토큰만 검사한다 — 사용자 행이 없어도 이 읽기 API 는 동작한다 */
	Cookie cookie() {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(UUID.randomUUID()));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
	}

	@Test
	@DisplayName("상품 검색: 이름으로 찾고 카테고리 이름·파일 키를 준다")
	void searchReturnsMatches() throws Exception {
		products.saveAndFlush(Product.builder().prodId("KP-2026-900001").categoryCode("P01-Q01-R001").prodName("PowerEdge R740")
			.prodBrand("Dell").prodNo("R740-4210").prodPhoto1("public/listings/photos/2026/10/m.jpg")
			.regDate("20261014120000").build());

		mvc.perform(get("/api/v1/products").param("q", " poweredge ").cookie(cookie()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.length()").value(1))
			.andExpect(jsonPath("$.data[0].prodId").value("KP-2026-900001"))
			.andExpect(jsonPath("$.data[0].categoryName").value("인텔 CPU"))
			.andExpect(jsonPath("$.data[0].prodNo").value("R740-4210"))
			.andExpect(jsonPath("$.data[0].prodPhoto1").value("public/listings/photos/2026/10/m.jpg"));
	}

	@Test
	@DisplayName("상품 검색: 로그인 없이는 401, 51자는 400 fields.q, 빈 검색어는 이름순 앞 10건")
	void searchRequiresAuthAndValidQuery() throws Exception {
		mvc.perform(get("/api/v1/products").param("q", "a")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/products").param("q", "a".repeat(51)).cookie(cookie()))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.q").isString());
		products.saveAndFlush(Product.builder().prodId("KP-2026-900009").categoryCode("P01-Q01-R001").prodName("아무 상품")
			.prodBrand("A").regDate("20261014120000").build());
		mvc.perform(get("/api/v1/products").param("q", "  ").cookie(cookie()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.length()").value(1))
			.andExpect(jsonPath("$.data[0].prodId").value("KP-2026-900009"));
	}

	@Test
	@DisplayName("카테고리 목록: 시드 239건이 코드순으로 나오고, 로그인 없이는 401")
	void categoriesListSeed() throws Exception {
		mvc.perform(get("/api/v1/categories")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/categories").cookie(cookie()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.length()").value(239))
			.andExpect(jsonPath("$.data[0].categoryCode").value("E01"))
			.andExpect(jsonPath("$.data[0].categoryClass").value("대"))
			.andExpect(jsonPath("$.data[0].parentCode").doesNotExist());
	}

}
