package com.company.market.trade.controller;

import com.company.market.TestUids;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService;
import com.company.market.listing.service.ProductService.ProductDraft;
import com.company.market.trade.service.CartBulkParser;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 엑셀 대량구매 API (계획 2026-11-09-bulk-purchase-excel.md 작업 5) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CartBulkApiTest {

	static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

	@Autowired
	ListingRepository listings;

	Cookie authCookie;

	String buyerId;

	final String sellerId = TestUids.random();

	Product product;

	@BeforeEach
	void setUp() {
		cleanUp();
		buyerId = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("cartbulkapi")
			.passwordHash("$2a$12$hash").nickname("cartbulkapi").email("cartbulkapi@example.com")
			.name("홍길동").phone("01077770126").phoneHash(hasher.hash("01077770126")).build()).getId();
		authCookie = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(buyerId));
		product = products.findOrCreate(new ProductDraft(CategoryFragments.parse("P01-Q01-R001"), "구매API 상품", null, "Acme", null, null, null,
				null, null, null, null));
		listings.saveAndFlush(Listing.builder().userId(sellerId).regDate("20261105100000").prodId(product.getProdId()).tradeType("등록").prodState("신품")
			.salesUnitPrice(1000).salesQuantity(10).minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").stockQuantity(10).build());
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_cart_info where user_id in (select uid from trd_user_info where user_id = 'cartbulkapi')");
		jdbc.update("delete from trd_trade_info where user_id in (select uid from trd_user_info where user_id = 'cartbulkapi')");
		jdbc.update("delete from trd_prod_reg where user_id = ?", sellerId);
		jdbc.update("delete from trd_prod_master where prod_name like '구매API %'");
		jdbc.update("delete from trd_user_info where user_id = 'cartbulkapi'");
	}

	/** 양식 헤더 + 줄. 줄 칸 순서는 CartBulkParser.HEADER_LABELS */
	private static byte[] workbook(List<String[]> rows) throws IOException {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("양식");
			Row h = sheet.createRow(0);
			for (int c = 0; c < CartBulkParser.HEADER_LABELS.size(); c++) {
				h.createCell(c).setCellValue(CartBulkParser.HEADER_LABELS.get(c));
			}
			for (int r = 0; r < rows.size(); r++) {
				Row row = sheet.createRow(r + 1);
				for (int c = 0; c < rows.get(r).length; c++) {
					if (rows.get(r)[c] != null) {
						row.createCell(c).setCellValue(rows.get(r)[c]);
					}
				}
			}
			wb.write(out);
			return out.toByteArray();
		}
	}

	/** 상품명, 제조사, 분류번호, 상품ID, 수량, 납품희망일, 요청사항 */
	private static String[] line(String name, String quantity) {
		return new String[] { name, "Acme", null, null, quantity, "2099-12-31", "메모" };
	}

	private MockMultipartFile file(String name, byte[] bytes) {
		return new MockMultipartFile("file", name, XLSX, bytes);
	}

	private static String rowsJson(String... rows) {
		return "{\"rows\":[" + String.join(",", rows) + "]}";
	}

	private static String rowJson(int rowNo, String name, String quantity) {
		return "{\"rowNo\":" + rowNo + ",\"prodName\":\"" + name + "\",\"prodBrand\":\"Acme\",\"orderQuantity\":\"" + quantity
				+ "\",\"reqDeliDate\":\"2099-12-31\"}";
	}

	@Test
	@DisplayName("양식 내려받기: 로그인하면 xlsx 첨부 파일로 내려온다")
	void template() throws Exception {
		mvc.perform(get("/api/v1/cart/bulk/template").cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(XLSX))
			.andExpect(header().string("Content-Disposition", containsString("attachment")));
	}

	@Test
	@DisplayName("parse → check → commit 흐름: 매물을 찾아 보여 주고, 담으면 내 장바구니에 줄이 생긴다")
	void parseCheckCommitFlow() throws Exception {
		byte[] book = workbook(List.of(line("구매API 상품", "3"), line("구매API 없는 상품", "1")));

		mvc.perform(multipart("/api/v1/cart/bulk/parse").file(file("a.xlsx", book)).cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rows.length()").value(2))
			.andExpect(jsonPath("$.data.results[0].status").value("AVAILABLE"))
			.andExpect(jsonPath("$.data.results[0].chosen.unitPrice").value(1000))
			.andExpect(jsonPath("$.data.results[1].status").value("FAILED"))
			.andExpect(jsonPath("$.data.cartMax").value(100))
			.andExpect(content().string(not(containsString("cartbulkapi@example.com"))));

		mvc.perform(post("/api/v1/cart/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(rowJson(2, "구매API 상품", "3"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].status").value("AVAILABLE"));

		mvc.perform(post("/api/v1/cart/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON)
				.content(rowsJson(rowJson(2, "구매API 상품", "3"), rowJson(3, "구매API 없는 상품", "1"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(true))
			.andExpect(jsonPath("$.data.results[1].ok").value(false))
			.andExpect(jsonPath("$.data.results[1].code").value("VALIDATION"))
			.andExpect(jsonPath("$.data.cartCount").value(1));

		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info where user_id = ?", Integer.class, buyerId)).isEqualTo(1);
	}

	@Test
	@DisplayName("check·commit 이 조건 칸을 받는다: 조건과 안 맞으면 CHOOSE + 다른 점(직접 고르면 담김)")
	void conditionsAndSort() throws Exception {
		String strict = "{\"rowNo\":2,\"prodName\":\"구매API 상품\",\"prodBrand\":\"Acme\",\"orderQuantity\":\"3\",\"reqDeliDate\":\"2099-12-31\","
				+ "\"maxPrice\":\"500\",\"minState\":\"신품\",\"needDataSheet\":\"Y\"}";

		mvc.perform(post("/api/v1/cart/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON)
				.content(rowsJson(strict)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].status").value("CHOOSE"))
			.andExpect(jsonPath("$.data.results[0].options[0].reason").doesNotExist())
			.andExpect(jsonPath("$.data.results[0].options[0].mismatches[0]").value(containsString("상한")))
			.andExpect(jsonPath("$.data.results[0].options[0].traits.prodState").value("신품"));

		mvc.perform(post("/api/v1/cart/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON)
				.content(rowsJson(strict)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(false))
			.andExpect(jsonPath("$.data.cartCount").value(0));
	}

	@Test
	@DisplayName("조건과 다른 매물을 사용자가 직접 고르면 담기고, 하드 막힘이면 안 담긴다")
	void commitsMismatchedChoice() throws Exception {
		String picked = "{\"rowNo\":2,\"prodName\":\"구매API 상품\",\"prodBrand\":\"Acme\",\"orderQuantity\":\"3\",\"reqDeliDate\":\"2099-12-31\","
				+ "\"maxPrice\":\"500\",\"sellerId\":\"" + sellerId + "\",\"regDate\":\"20261105100000\"}";

		mvc.perform(post("/api/v1/cart/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(picked)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(true))
			.andExpect(jsonPath("$.data.cartCount").value(1));

		// 고르지 않으면 조건과 다른 매물만 있는 줄은 자동으로 담기지 않는다
		String unpicked = "{\"rowNo\":3,\"prodName\":\"구매API 상품\",\"prodBrand\":\"Acme\",\"orderQuantity\":\"3\",\"reqDeliDate\":\"2099-12-31\",\"maxPrice\":\"500\"}";
		mvc.perform(post("/api/v1/cart/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(unpicked)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(false))
			.andExpect(jsonPath("$.data.results[0].code").value("NO_CHOICE"));

		// 하드 막힘(재고 10 보다 많이)이면 직접 골라도 거절된다
		String tooMany = picked.replace("\"orderQuantity\":\"3\"", "\"orderQuantity\":\"11\"").replace("\"rowNo\":2", "\"rowNo\":4");
		mvc.perform(post("/api/v1/cart/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(tooMany)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].ok").value(false))
			.andExpect(jsonPath("$.data.cartCount").value(1));
	}

	@Test
	@DisplayName("로그인 없이 양식·parse·check·commit 은 401")
	void unauthenticated() throws Exception {
		mvc.perform(get("/api/v1/cart/bulk/template")).andExpect(status().isUnauthorized());
		mvc.perform(multipart("/api/v1/cart/bulk/parse").file(file("a.xlsx", workbook(List.of())))).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/cart/bulk/check").contentType(MediaType.APPLICATION_JSON).content(rowsJson(rowJson(2, "구매API 상품", "3"))))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/cart/bulk/commit").contentType(MediaType.APPLICATION_JSON).content(rowsJson(rowJson(2, "구매API 상품", "3"))))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("xlsx 가 아닌 파일·엑셀을 가장한 파일·헤더가 다른 파일은 400 fields.file")
	void badFiles() throws Exception {
		mvc.perform(multipart("/api/v1/cart/bulk/parse").file(file("a.txt", "x".getBytes(StandardCharsets.UTF_8))).cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.file").exists());
		mvc.perform(multipart("/api/v1/cart/bulk/parse").file(file("a.xlsx", "not excel".getBytes(StandardCharsets.UTF_8))).cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.file").exists());
	}

	@Test
	@DisplayName("줄 없음·101줄은 400, 데이터가 없는 양식은 빈 결과")
	void rowBounds() throws Exception {
		mvc.perform(post("/api/v1/cart/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson()))
			.andExpect(status().isBadRequest());
		mvc.perform(multipart("/api/v1/cart/bulk/parse").file(file("a.xlsx", workbook(List.of()))).cookie(authCookie))
			.andExpect(status().isOk()).andExpect(jsonPath("$.data.rows.length()").value(0));
		String[] many = new String[101];
		for (int i = 0; i < many.length; i++) {
			many[i] = rowJson(i + 2, "구매API 상품", "3");
		}
		mvc.perform(post("/api/v1/cart/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(many)))
			.andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("줄 번호가 0 이하이거나 글자가 너무 길면 400")
	void invalidRowDto() throws Exception {
		mvc.perform(post("/api/v1/cart/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(rowJson(0, "구매API 상품", "3"))))
			.andExpect(status().isBadRequest());
		mvc.perform(post("/api/v1/cart/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON)
				.content(rowsJson(rowJson(2, "가".repeat(301), "3"))))
			.andExpect(status().isBadRequest());
	}

}
