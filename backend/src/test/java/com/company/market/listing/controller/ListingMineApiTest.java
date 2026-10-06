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

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 내 매물 목록 (추가등록 화면이 대상 매물을 고를 때). 데이터는 repository 로 직접 만든다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingMineApiTest {

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

	UUID userId;

	UUID otherId;

	Cookie auth;

	@BeforeEach
	void setUp() {
		cleanUp();
		userId = newUser("minetester", "01012340001");
		otherId = newUser("mineother", "01012340002");
		auth = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(userId, UserRole.USER));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from listings");
		jdbc.update("delete from products");
		jdbc.update("delete from users where role <> 'admin'");
	}

	@Test
	@DisplayName("내 매물만 최신순으로 돌려주고 남의 매물은 안 나온다")
	void mineReturnsOnlyMyListingsNewestFirst() throws Exception {
		save(userId, "ELEC00010001", "20261001090001", "A");
		save(userId, "ELEC00010002", "20261001090003", "C");
		save(userId, "ELEC00010003", "20261001090002", "B");
		save(otherId, "ELEC00010004", "20261001090004", "남의 것");

		mvc.perform(get("/api/v1/listings/mine").cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(3)))
			.andExpect(jsonPath("$.data.items[0].prodName").value("C"))
			.andExpect(jsonPath("$.data.items[1].prodName").value("B"))
			.andExpect(jsonPath("$.data.items[2].prodName").value("A"))
			.andExpect(jsonPath("$.data.items[0].userId").value(userId.toString()))
			.andExpect(jsonPath("$.data.items[0].email").doesNotExist())
			.andExpect(jsonPath("$.data.items[0].phone").doesNotExist())
			.andExpect(jsonPath("$.data.nextCursor").value(nullValue()));
	}

	@Test
	@DisplayName("extraFilled 는 보증기간·불량지원·대체품·테스트리포트·인증서 중 채운 개수")
	void mineExtraFilledCountsFiveFields() throws Exception {
		save(userId, "ELEC00010001", "20261001090002", "채움");
		save(userId, "ELEC00010002", "20261001090001", "빈것");
		jdbc.update("update listings set warranty_period = 90, warranty_coverage = '대체', test_report = 'private/listings/test-reports/2026/10/x.pdf' where reg_date = '20261001090002'");

		mvc.perform(get("/api/v1/listings/mine").cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items[0].extraFilled").value(3))
			.andExpect(jsonPath("$.data.items[1].extraFilled").value(0));
	}

	@Test
	@DisplayName("보증기간 0일(없음)은 채운 것으로 세지 않는다 — 보여 줄 보증 정보가 없다")
	void mineZeroWarrantyIsNotFilled() throws Exception {
		save(userId, "ELEC00010001", "20261001090001", "없음");
		jdbc.update("update listings set warranty_period = 0 where reg_date = '20261001090001'");

		mvc.perform(get("/api/v1/listings/mine").cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items[0].extraFilled").value(0));
	}

	@Test
	@DisplayName("20개씩 커서로 이어진다 — 21개면 첫 페이지 20 + nextCursor, 둘째 페이지 1개")
	void minePagesByCursor() throws Exception {
		for (int i = 1; i <= 21; i++) {
			save(userId, "ELEC0001%04d".formatted(i), "202610010900%02d".formatted(i), "상품 " + i);
		}

		String body = mvc.perform(get("/api/v1/listings/mine").cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(20)))
			.andExpect(jsonPath("$.data.items[0].prodName").value("상품 21"))
			.andReturn().getResponse().getContentAsString();
		String cursor = com.jayway.jsonpath.JsonPath.read(body, "$.data.nextCursor");

		mvc.perform(get("/api/v1/listings/mine").param("cursor", cursor).cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(1)))
			.andExpect(jsonPath("$.data.items[0].prodName").value("상품 1"))
			.andExpect(jsonPath("$.data.nextCursor").value(nullValue()));
	}

	@Test
	@DisplayName("로그인하지 않으면 401 UNAUTHENTICATED")
	void mineRequiresLogin() throws Exception {
		mvc.perform(get("/api/v1/listings/mine"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
	}

	@Test
	@DisplayName("형식이 깨진 커서는 오류 없이 첫 페이지")
	void mineBrokenCursorReturnsFirstPage() throws Exception {
		save(userId, "ELEC00010001", "20261001090001", "A");

		mvc.perform(get("/api/v1/listings/mine").param("cursor", "zzz").cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(1)));
	}

	@Test
	@DisplayName("가격·수량·거래상태·대표 사진을 돌려준다")
	void mineReturnsPriceQuantityStatusAndPhoto() throws Exception {
		save(userId, "ELEC00010001", "20261001090001", "A", "public/listings/photos/2026/10/a.jpg");

		mvc.perform(get("/api/v1/listings/mine").cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items[0].salesUnitPrice").value(1000))
			.andExpect(jsonPath("$.data.items[0].salesQuantity").value(1))
			.andExpect(jsonPath("$.data.items[0].tradeStatus").value("available"))
			.andExpect(jsonPath("$.data.items[0].photo").value("public/listings/photos/2026/10/a.jpg"));
	}

	@Test
	@DisplayName("거래완료 글은 completed, 사진이 없으면 photo 는 null")
	void mineCompletedStatusAndNoPhoto() throws Exception {
		save(userId, "ELEC00010001", "20261001090001", "A");
		jdbc.update("update listings set dt_expire = 20261002000000 where user_id = ?", userId);

		mvc.perform(get("/api/v1/listings/mine").cookie(auth))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items[0].tradeStatus").value("completed"))
			.andExpect(jsonPath("$.data.items[0].photo").value(nullValue()));
	}

	private UUID newUser(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).email(loginId + "@example.com").name("홍길동").phone(phone).phoneHash(hasher.hash(phone))
			.build()).getId();
	}

	private void save(UUID owner, String prodId, String regDate, String name) {
		save(owner, prodId, regDate, name, null);
	}

	private void save(UUID owner, String prodId, String regDate, String name, String photo) {
		productRepository.saveAndFlush(Product.builder().prodId(prodId).categoryCode("ELEC0001").prodName(name)
			.prodBrand("삼성").regDate(regDate).build());
		listingRepository.saveAndFlush(Listing.builder().userId(owner).regDate(regDate).prodId(prodId).tradeType("등록")
			.prodState("신품").salesUnitPrice(1000).salesQuantity(1).minOrderQuantity(1).orderUnit(1).stockQuantity(1).prodPhoto1(photo)
			.build());
	}

}
