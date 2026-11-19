package com.company.market.listing.controller;

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
import com.company.market.listing.service.ListingBulkParser;
import com.company.market.listing.service.ProductService;
import com.company.market.listing.service.ProductService.ProductDraft;
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

/** 엑셀 다량 등록 API (계획 2026-11-05-bulk-listing-excel.md 작업 4) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingBulkApiTest {

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

	Cookie authCookie;

	UUID userId;

	@BeforeEach
	void setUp() {
		cleanUp();
		userId = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("bulkapitester")
			.passwordHash("$2a$12$hash").nickname("bulkapitester").email("bulkapitester@example.com")
			.name("홍길동").phone("01077770123").phoneHash(hasher.hash("01077770123")).build()).getId();
		authCookie = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(userId));
		products.findOrCreate(new ProductDraft(CategoryFragments.parse("P01-Q01-R001"), "API 스위치", null, "Cisco", null, null, null,
				null, null, null, "public/listings/photos/2026/10/a.jpg"));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id in (select uid from trd_user_info where user_id = 'bulkapitester')");
		jdbc.update("delete from trd_prod_master where prod_name like 'API %'");
		jdbc.update("delete from trd_user_info where user_id = 'bulkapitester'");
	}

	/** 양식 헤더 + 줄. 줄 칸 순서는 ListingBulkParser.HEADER_LABELS */
	private static byte[] workbook(List<String[]> rows) throws IOException {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("양식");
			Row h = sheet.createRow(0);
			for (int c = 0; c < ListingBulkParser.HEADER_LABELS.size(); c++) {
				h.createCell(c).setCellValue(ListingBulkParser.HEADER_LABELS.get(c));
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

	private static String[] line(String name, String quantity) {
		return new String[] { name, "Cisco", null, null, "P01-Q01-R001", null, "신품", "1000", quantity, null, null, "2099-12-31", "메모" };
	}

	private MockMultipartFile file(String name, byte[] bytes) {
		return new MockMultipartFile("file", name, XLSX, bytes);
	}

	private static String rowsJson(String... rows) {
		return "{\"rows\":[" + String.join(",", rows) + "]}";
	}

	private static String rowJson(int rowNo, String name, String quantity) {
		return "{\"rowNo\":" + rowNo + ",\"prodName\":\"" + name + "\",\"prodBrand\":\"Cisco\",\"categoryCode\":\"P01-Q01-R001\","
				+ "\"prodState\":\"신품\",\"salesUnitPrice\":\"1000\",\"salesQuantity\":\"" + quantity + "\",\"deliveryDate\":\"2099-12-31\"}";
	}

	@Test
	@DisplayName("양식 내려받기: xlsx 첨부 파일로 내려온다")
	void template() throws Exception {
		mvc.perform(get("/api/v1/listings/bulk/template"))
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(XLSX))
			.andExpect(header().string("Content-Disposition", containsString("attachment")));
	}

	@Test
	@DisplayName("parse → check → commit 흐름: 읽은 줄과 결과가 오고, 확정하면 등록된다")
	void parseCheckCommitFlow() throws Exception {
		byte[] book = workbook(List.of(line("API 스위치", "3"), line("API 새상품", "2")));

		mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.xlsx", book)).cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rows.length()").value(2))
			.andExpect(jsonPath("$.data.results[0].status").value("MATCHED"))
			.andExpect(jsonPath("$.data.results[1].status").value("NEW_MASTER"))
			.andExpect(content().string(not(containsString("bulkapitester@example.com"))));

		mvc.perform(post("/api/v1/listings/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON)
				.content(rowsJson(rowJson(2, "API 스위치", "3"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].status").value("MATCHED"));

		mvc.perform(post("/api/v1/listings/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON)
				.content(rowsJson(rowJson(2, "API 스위치", "3"), rowJson(3, "API 새상품", "2"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.created").value(2));

		assertThat(jdbc.queryForObject("select count(*) from trd_prod_reg where user_id = ?", Integer.class, userId)).isEqualTo(2);
	}

	/** 사진1 칸에 파일명을 적은 한 줄: HEADER_LABELS 13칸 + 사진1 */
	private static byte[] workbookWithPhoto(String photoName) throws IOException {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("양식");
			Row h = sheet.createRow(0);
			List<String> labels = new java.util.ArrayList<>(ListingBulkParser.HEADER_LABELS);
			labels.addAll(ListingBulkParser.FILE_LABELS);
			for (int c = 0; c < labels.size(); c++) {
				h.createCell(c).setCellValue(labels.get(c));
			}
			String[] values = line("API 스위치", "3");
			Row row = sheet.createRow(1);
			for (int c = 0; c < values.length; c++) {
				if (values[c] != null) {
					row.createCell(c).setCellValue(values[c]);
				}
			}
			row.createCell(ListingBulkParser.HEADER_LABELS.size()).setCellValue(photoName);
			wb.write(out);
			return out.toByteArray();
		}
	}

	private static MockMultipartFile zipFile(String entryName, byte[] content) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (java.util.zip.ZipOutputStream z = new java.util.zip.ZipOutputStream(out)) {
			z.putNextEntry(new java.util.zip.ZipEntry(entryName));
			z.write(content);
			z.closeEntry();
		}
		return new MockMultipartFile("attachments", "files.zip", "application/zip", out.toByteArray());
	}

	private static final byte[] JPG = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1 };

	@Test
	@DisplayName("엑셀 + ZIP: parse 가 사진 키를 돌려주고, 그 줄을 그대로 commit 하면 매물에 저장된다")
	void parseWithZipThenCommit() throws Exception {
		String body = mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.xlsx", workbookWithPhoto("pic.JPG")))
				.file(zipFile("pic.jpg", JPG)).cookie(authCookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rows[0].photo1.name").value("pic.JPG"))
			.andExpect(jsonPath("$.data.rows[0].photo1.key").value(containsString("public/listings/photos/")))
			.andExpect(jsonPath("$.data.results[0].fields").isEmpty())
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		String rowJson = new tools.jackson.databind.ObjectMapper().readTree(body).get("data").get("rows").get(0).toString();

		mvc.perform(post("/api/v1/listings/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(rowJson)))
			.andExpect(status().isOk()).andExpect(jsonPath("$.data.created").value(1));

		assertThat(jdbc.queryForObject("select prod_photo_1 from trd_prod_reg where user_id = ?", String.class, userId))
			.startsWith("public/listings/photos/");
	}

	@Test
	@DisplayName("ZIP 이 폴더가 든 ZIP 이면 400 fields.attachments, 로그인 없으면 401")
	void badZipAndUnauthenticated() throws Exception {
		mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.xlsx", workbookWithPhoto("pic.jpg")))
				.file(zipFile("dir/pic.jpg", JPG)).cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.attachments").exists());
		mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.xlsx", workbookWithPhoto("pic.jpg"))).file(zipFile("pic.jpg", JPG)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("로그인 없이 parse·check·commit 은 401")
	void unauthenticated() throws Exception {
		mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.xlsx", workbook(List.of())))).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/listings/bulk/check").contentType(MediaType.APPLICATION_JSON).content(rowsJson(rowJson(2, "API 스위치", "3"))))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/listings/bulk/commit").contentType(MediaType.APPLICATION_JSON).content(rowsJson(rowJson(2, "API 스위치", "3"))))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("xlsx 가 아닌 파일·엑셀을 가장한 파일은 400 fields.file")
	void badFiles() throws Exception {
		mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.txt", "x".getBytes(StandardCharsets.UTF_8))).cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.file").exists());
		mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.xlsx", "not excel".getBytes(StandardCharsets.UTF_8))).cookie(authCookie))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.file").exists());
	}

	@Test
	@DisplayName("줄 없음·201줄은 400, 데이터가 없는 양식은 빈 결과")
	void rowBounds() throws Exception {
		mvc.perform(post("/api/v1/listings/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson()))
			.andExpect(status().isBadRequest());
		mvc.perform(multipart("/api/v1/listings/bulk/parse").file(file("a.xlsx", workbook(List.of()))).cookie(authCookie))
			.andExpect(status().isOk()).andExpect(jsonPath("$.data.rows.length()").value(0));
		String[] many = new String[201];
		for (int i = 0; i < many.length; i++) {
			many[i] = rowJson(i + 2, "API 스위치", "3");
		}
		mvc.perform(post("/api/v1/listings/bulk/check").cookie(authCookie).contentType(MediaType.APPLICATION_JSON).content(rowsJson(many)))
			.andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("commit 에 틀린 줄이 있으면 409 LISTING_BULK_INVALID 와 줄번호.칸 사유, 아무것도 저장되지 않는다")
	void commitWithInvalidRow() throws Exception {
		mvc.perform(post("/api/v1/listings/bulk/commit").cookie(authCookie).contentType(MediaType.APPLICATION_JSON)
				.content(rowsJson(rowJson(2, "API 스위치", "3"), rowJson(3, "API 새상품", "0"))))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("LISTING_BULK_INVALID"))
			.andExpect(jsonPath("$.fields['3.salesQuantity']").exists());

		assertThat(jdbc.queryForObject("select count(*) from trd_prod_reg where user_id = ?", Integer.class, userId)).isZero();
	}

}
