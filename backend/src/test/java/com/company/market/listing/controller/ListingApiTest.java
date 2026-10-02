package com.company.market.listing.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.storage.UploadKind;
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
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 매물 직접입력 등록. 인증은 access_token 쿠키(JwtAuthenticationFilter 는 쿠키만 읽음 — Authorization 헤더는 안 봄) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingApiTest {

	static final byte[] JPG = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1 };

	static final byte[] PDF = "%PDF-1.7\n%test".getBytes(StandardCharsets.US_ASCII);

	static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	@Autowired
	MockMvc mvc;

	@Autowired
	StringRedisTemplate redis;

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
		String p1 = uploaded(authCookie, UploadKind.LISTING_PHOTO);
		String p2 = uploaded(authCookie, UploadKind.LISTING_PHOTO);

		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 X","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":500000,"salesQuantity":3,
					 "photos":["%s","%s"]}
					""".formatted(p1, p2)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.ok").value(true))
			.andExpect(jsonPath("$.data.prodId").value("ELEC00010001"))
			.andExpect(jsonPath("$.data.photos[0]").value(p1));

		assertThat(jdbc.queryForObject("select prod_photo_1 from products where prod_id = 'ELEC00010001'", String.class)).isEqualTo(p1);
	}

	@Test
	@DisplayName("가격이 10억을 넘으면 400 VALIDATION, fields.salesUnitPrice")
	void priceOverLimit() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 Y","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":2000000000,"salesQuantity":1}
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
		// 서로 다른 사용자로 호출 — 같은 사용자가 같은 초에 두 번 등록하면 (user_id, reg_date) 충돌로 409가 난다
		// (Persistable 도입 후 merge 가 아니라 실제 INSERT 충돌로 감지됨. 이 테스트의 관심사는 사진 개수 처리라
		// 시간 충돌 자체는 다른 테스트(listing.repository.*DoesNotSilentlyOverwrite)가 고정한다).
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 Z1","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.photos.length()").value(0));

		Cookie other = otherUserCookie();
		mvc.perform(post("/api/v1/listings").cookie(other)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 Z2","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,
					 "photos":["%s","%s","%s","%s"]}
					""".formatted(uploaded(other, UploadKind.LISTING_PHOTO), uploaded(other, UploadKind.LISTING_PHOTO),
						uploaded(other, UploadKind.LISTING_PHOTO), uploaded(other, UploadKind.LISTING_PHOTO))))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.photos.length()").value(4));
	}

	@Test
	@DisplayName("사진이 4장을 넘거나 경로가 100자를 넘으면 400 VALIDATION, fields.photos")
	void photosOverLimit() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 P1","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,
					 "photos":["a.jpg","b.jpg","c.jpg","d.jpg","e.jpg"]}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.photos").isString());

		String tooLong = "x".repeat(101) + ".jpg";
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 P2","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,
					 "photos":["%s"]}
					""".formatted(tooLong)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['photos[0]']").isString());
	}

	@Test
	@DisplayName("사진 경로가 빈 문자열·공백이면 400")
	void photosRejectsBlankElement() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 P3","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,
					 "photos":["  "]}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields['photos[0]']").isString());
	}

	@Test
	@DisplayName("최소주문량이 판매수량보다 크면 400 VALIDATION")
	void minOrderQuantityCannotExceedSalesQuantity() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 P4","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":5,
					 "minOrderQuantity":10}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.minOrderQuantity").isString());
	}

	@Test
	@DisplayName("상품명·제조사 앞뒤 공백이 달라도 같은 상품으로 재사용한다")
	void productMatchingTrimsWhitespace() throws Exception {
		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 T","prodBrand":"삼성 ",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.prodId").value("ELEC00010001"));

		mvc.perform(post("/api/v1/listings").cookie(otherUserCookie())
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":" 노트북 T","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.prodId").value("ELEC00010001"));

		assertThat(jdbc.queryForObject("select count(*) from products", Integer.class)).isEqualTo(1);
	}

	@Test
	@DisplayName("등록한 매물을 상세 조회하면 그대로 나온다")
	void getReturnsCreatedListing() throws Exception {
		MvcResult created = mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 G","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1}
					"""))
			.andExpect(status().isCreated()).andReturn();
		String regDate = created.getResponse().getContentAsString().replaceAll(".*\"regDate\":\"([^\"]+)\".*", "$1");

		mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.prodName").value("노트북 G"));
	}

	@Test
	@DisplayName("등록 시 보낸 상품번호·사양정보·매물 데이터시트가 응답에 그대로 담긴다")
	void responseIncludesProductAndListingDetailFields() throws Exception {
		String sheet = uploaded(authCookie, UploadKind.LISTING_DATASHEET);

		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 D","prodBrand":"삼성",
					 "prodNo":"MODEL-1","prodSpecInfo":"i7/16GB/512GB",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,
					 "listingDataSheet":"%s"}
					""".formatted(sheet)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.prodNo").value("MODEL-1"))
			.andExpect(jsonPath("$.data.prodSpecInfo").value("i7/16GB/512GB"))
			.andExpect(jsonPath("$.data.listingDataSheet").value(sheet));
	}

	@Test
	@DisplayName("업로드한 사진·데이터시트 키로 등록하면 저장되고 업로드 기록은 지워진다")
	void uploadedKeysAreSavedAndReleased() throws Exception {
		String p1 = uploaded(authCookie, UploadKind.LISTING_PHOTO);
		String p2 = uploaded(authCookie, UploadKind.LISTING_PHOTO);
		String sheet = uploaded(authCookie, UploadKind.LISTING_DATASHEET);

		mvc.perform(post("/api/v1/listings").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 K1","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,
					 "photos":["%s","%s"],"listingDataSheet":"%s","productDataSheet":"%s"}
					""".formatted(p1, p2, sheet, sheet)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.photos[0]").value(p1))
			.andExpect(jsonPath("$.data.photos[1]").value(p2))
			.andExpect(jsonPath("$.data.listingDataSheet").value(sheet));

		assertThat(redis.hasKey("upload:" + p1)).isFalse();
		assertThat(redis.hasKey("upload:" + p2)).isFalse();
		assertThat(redis.hasKey("upload:" + sheet)).isFalse();
	}

	@Test
	@DisplayName("다른 사용자가 올린 키로 등록하면 400 VALIDATION, fields.photos")
	void rejectsOthersUpload() throws Exception {
		String othersPhoto = uploaded(otherUserCookie(), UploadKind.LISTING_PHOTO);

		createWithPhoto(othersPhoto, "노트북 K2").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.fields.photos").value("파일을 다시 올려 주세요."));
	}

	@Test
	@DisplayName("용도가 다른 키(사진 칸에 데이터시트 키)는 400, fields.photos")
	void rejectsWrongKind() throws Exception {
		createWithPhoto(uploaded(authCookie, UploadKind.LISTING_DATASHEET), "노트북 K3").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.photos").value("파일을 다시 올려 주세요."));
	}

	@Test
	@DisplayName("이미 등록에 쓴 키를 다시 쓰면 400")
	void rejectsReusedKey() throws Exception {
		String photo = uploaded(authCookie, UploadKind.LISTING_PHOTO);
		createWithPhoto(photo, "노트북 K4").andExpect(status().isCreated());

		createWithPhoto(photo, "노트북 K5").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.photos").value("파일을 다시 올려 주세요."));
	}

	@Test
	@DisplayName("업로드 기록이 없는 키(만료·조작)는 400")
	void rejectsUnrecordedKeys() throws Exception {
		String expired = uploaded(authCookie, UploadKind.LISTING_PHOTO);
		redis.delete("upload:" + expired);

		createWithPhoto(expired, "노트북 K6").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.photos").value("파일을 다시 올려 주세요."));
		// 100자 안의 경로 조작 (넘으면 Bean Validation 이 photos[0] 으로 먼저 막는다)
		createWithPhoto("public/listings/photos/../../x/2026/10/" + UUID.randomUUID() + ".jpg", "노트북 K7")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.photos").isString());
		createWithPhoto("p1.jpg", "노트북 K8").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.photos").isString());
	}

	@Test
	@DisplayName("수정할 때 이미 이 매물에 있는 사진 키는 다시 올리지 않아도 통과한다")
	void updateKeepsExistingKeys() throws Exception {
		String a = uploaded(authCookie, UploadKind.LISTING_PHOTO);
		String regDate = createWithPhoto(a, "노트북 K9").andExpect(status().isCreated()).andReturn().getResponse()
			.getContentAsString().replaceAll(".*\"regDate\":\"([^\"]+)\".*", "$1");
		String c = uploaded(authCookie, UploadKind.LISTING_PHOTO);

		patchListing(regDate, "{\"photos\":[\"%s\",\"%s\"]}".formatted(a, c)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.photos[0]").value(a))
			.andExpect(jsonPath("$.data.photos[1]").value(c));
		assertThat(redis.hasKey("upload:" + c)).isFalse();
	}

	@Test
	@DisplayName("수정으로 사진을 전부 빼면(photos: []) 성공한다")
	void updateRemovesAllPhotos() throws Exception {
		String regDate = createWithPhoto(uploaded(authCookie, UploadKind.LISTING_PHOTO), "노트북 K10")
			.andExpect(status().isCreated()).andReturn().getResponse()
			.getContentAsString().replaceAll(".*\"regDate\":\"([^\"]+)\".*", "$1");

		patchListing(regDate, "{\"photos\":[]}").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.photos.length()").value(0));
	}

	@Test
	@DisplayName("수정에서 테스트리포트·정품인증서·대체품도 본인 업로드 키만 받는다")
	void updateChecksWarrantyFiles() throws Exception {
		String regDate = createListing(authCookie);
		String report = uploaded(authCookie, UploadKind.LISTING_TEST_REPORT);
		String cert = uploaded(authCookie, UploadKind.LISTING_CERTIFICATE);
		String replace = uploaded(authCookie, UploadKind.LISTING_REPLACE_PROD);

		patchListing(regDate, "{\"testReport\":\"%s\",\"certificateOfAuthen\":\"%s\",\"replaceProd\":\"%s\"}"
			.formatted(report, cert, replace))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.testReport").value(report))
			.andExpect(jsonPath("$.data.certificateOfAuthen").value(cert))
			.andExpect(jsonPath("$.data.replaceProd").value(replace));

		patchListing(regDate, "{\"testReport\":\"%s\"}".formatted(uploaded(authCookie, UploadKind.LISTING_PHOTO)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.testReport").value("파일을 다시 올려 주세요."));
	}

	@Test
	@DisplayName("수정에서 파일 칸에 빈 문자열을 보내면 그 칸을 비운다")
	void updateClearsFileFieldsWithEmptyString() throws Exception {
		String regDate = createListing(authCookie);
		String report = uploaded(authCookie, UploadKind.LISTING_TEST_REPORT);
		String sheet = uploaded(authCookie, UploadKind.LISTING_DATASHEET);
		patchListing(regDate, "{\"testReport\":\"%s\",\"listingDataSheet\":\"%s\"}".formatted(report, sheet))
			.andExpect(status().isOk());

		patchListing(regDate, "{\"testReport\":\"\",\"listingDataSheet\":\"\",\"certificateOfAuthen\":\"\",\"replaceProd\":\"\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.testReport").value(org.hamcrest.Matchers.nullValue()))
			.andExpect(jsonPath("$.data.listingDataSheet").value(org.hamcrest.Matchers.nullValue()));

		assertThat(jdbc.queryForObject("select test_report from listings where user_id = ? and reg_date = ?", String.class,
				userId, regDate)).isNull();
		assertThat(jdbc.queryForObject("select prod_data_sheet from listings where user_id = ? and reg_date = ?", String.class,
				userId, regDate)).isNull();
	}

	@Test
	@DisplayName("상품상태는 '신품' 또는 '신품대비 1~99%'만 받는다")
	void prodStateFormat() throws Exception {
		String regDate = createListing(authCookie);
		for (String ok : new String[] { "신품", "신품대비 1%", "신품대비 99%" }) {
			patchListing(regDate, "{\"prodState\":\"%s\"}".formatted(ok)).andExpect(status().isOk());
		}
		for (String bad : new String[] { "new", "신품대비 0%", "신품대비 100%", "신품대비 05%" }) {
			patchListing(regDate, "{\"prodState\":\"%s\"}".formatted(bad)).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.prodState").isString());
		}
		createWithFields("노트북 S1", "\"prodState\":\"양호\"").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.prodState").isString());
	}

	@Test
	@DisplayName("제조일은 yyyyMMdd 실제 날짜만, 미래면 400")
	void prodMufcDateRules() throws Exception {
		String tomorrow = LocalDate.now(SEOUL).plusDays(1).format(DateTimeFormatter.BASIC_ISO_DATE);
		for (String bad : new String[] { "2020-01-01", "20261340", tomorrow }) {
			createWithFields("노트북 M-" + bad, "\"prodMufcDate\":\"%s\"".formatted(bad)).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.prodMufcDate").isString());
		}
		createWithFields("노트북 M-ok", "\"prodMufcDate\":\"20200101\"").andExpect(status().isCreated());
	}

	@Test
	@DisplayName("납기일은 YYYY-MM-DD 실제 날짜만, 과거면 400")
	void deliveryDateRules() throws Exception {
		String today = LocalDate.now(SEOUL).toString();
		String yesterday = LocalDate.now(SEOUL).minusDays(1).toString();
		for (String bad : new String[] { "20261002", "2026-02-30", yesterday }) {
			createWithFields("노트북 D-" + bad, "\"deliveryDate\":\"%s\"".formatted(bad)).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.deliveryDate").isString());
		}
		createWithFields("노트북 D-ok", "\"deliveryDate\":\"%s\"".formatted(today)).andExpect(status().isCreated());
	}

	@Test
	@DisplayName("수정(PATCH)도 같은 상품상태·날짜 규칙을 적용한다")
	void updateAppliesSameRules() throws Exception {
		String regDate = createListing(authCookie);
		String yesterday = LocalDate.now(SEOUL).minusDays(1).toString();

		patchListing(regDate, "{\"prodState\":\"new\"}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.prodState").isString());
		patchListing(regDate, "{\"deliveryDate\":\"%s\"}".formatted(yesterday)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.deliveryDate").isString());
		patchListing(regDate, "{\"salesUnitPrice\":1}").andExpect(status().isOk());
	}

	private ResultActions createWithFields(String prodName, String extraJson) throws Exception {
		return mvc.perform(post("/api/v1/listings").cookie(authCookie)
			.contentType(MediaType.APPLICATION_JSON).content("""
				{"categoryCode":"ELEC0001","prodName":"%s","prodBrand":"삼성",
				 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,%s}
				""".formatted(prodName, extraJson)));
	}

	private ResultActions createWithPhoto(String photoKey, String prodName) throws Exception {
		return mvc.perform(post("/api/v1/listings").cookie(authCookie)
			.contentType(MediaType.APPLICATION_JSON).content("""
				{"categoryCode":"ELEC0001","prodName":"%s","prodBrand":"삼성",
				 "tradeType":"판매","prodState":"신품","salesUnitPrice":1000,"salesQuantity":1,
				 "photos":["%s"]}
				""".formatted(prodName, photoKey)));
	}

	private ResultActions patchListing(String regDate, String json) throws Exception {
		return mvc.perform(patch("/api/v1/listings/" + userId + "/" + regDate).cookie(authCookie)
			.contentType(MediaType.APPLICATION_JSON).content(json));
	}

	/** 실제 업로드 API 로 올리고 키를 돌려준다 — 등록·수정은 본인이 올린 키만 받으므로 */
	private String uploaded(Cookie cookie, UploadKind kind) throws Exception {
		boolean photo = kind == UploadKind.LISTING_PHOTO;
		MockMultipartFile file = new MockMultipartFile("file", photo ? "a.jpg" : "a.pdf", "application/octet-stream",
				photo ? JPG : PDF);
		String body = mvc.perform(multipart("/api/v1/uploads").file(file).param("kind", kind.value()).cookie(cookie))
			.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		return body.replaceAll(".*\"key\":\"([^\"]+)\".*", "$1");
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

	private String createListing(Cookie cookie) throws Exception {
		MvcResult created = mvc.perform(post("/api/v1/listings").cookie(cookie)
				.contentType(MediaType.APPLICATION_JSON).content("""
					{"categoryCode":"ELEC0001","prodName":"노트북 U","prodBrand":"삼성",
					 "tradeType":"판매","prodState":"신품","salesUnitPrice":500000,"salesQuantity":1}
					"""))
			.andExpect(status().isCreated()).andReturn();
		return created.getResponse().getContentAsString().replaceAll(".*\"regDate\":\"([^\"]+)\".*", "$1");
	}

	private Cookie otherUserCookie() {
		User other = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("listingapiother")
			.passwordHash("$2a$12$hash").nickname("listingapiother").email("listingapiother@example.com")
			.name("김철수").phone("01099998888").phoneHash(hasher.hash("01099998888")).build());
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(other.getId(), UserRole.USER));
	}

	@Test
	@DisplayName("본인 매물의 가격을 수정하면 반영된다")
	void ownerCanUpdate() throws Exception {
		String regDate = createListing(authCookie);

		mvc.perform(patch("/api/v1/listings/" + userId + "/" + regDate).cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("{\"salesUnitPrice\":600000}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.salesUnitPrice").value(600000));
	}

	@Test
	@DisplayName("다른 사용자의 매물을 수정하려 하면 403이고 실제로 바뀌지 않는다")
	void othersCannotUpdate() throws Exception {
		String regDate = createListing(authCookie);

		mvc.perform(patch("/api/v1/listings/" + userId + "/" + regDate).cookie(otherUserCookie())
				.contentType(MediaType.APPLICATION_JSON).content("{\"salesUnitPrice\":1}"))
			.andExpect(status().isForbidden());

		mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate))
			.andExpect(jsonPath("$.data.salesUnitPrice").value(500000));
	}

	@Test
	@DisplayName("없는 매물을 수정하려 하면 404")
	void updateMissingIsNotFound() throws Exception {
		mvc.perform(patch("/api/v1/listings/" + UUID.randomUUID() + "/20260101000000").cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("{\"salesUnitPrice\":1}"))
			.andExpect(status().isNotFound());
	}

	@Test
	@DisplayName("로그인 없이 수정하면 401")
	void updateRequiresAuth() throws Exception {
		mvc.perform(patch("/api/v1/listings/" + UUID.randomUUID() + "/20260101000000")
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("가격이 10억을 넘는 수정은 400 VALIDATION, fields.salesUnitPrice — 실제로 바뀌지 않는다")
	void updateValidationFailureDoesNotChangeData() throws Exception {
		String regDate = createListing(authCookie);

		mvc.perform(patch("/api/v1/listings/" + userId + "/" + regDate).cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("{\"salesUnitPrice\":2000000000}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.salesUnitPrice").isString());

		mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate))
			.andExpect(jsonPath("$.data.salesUnitPrice").value(500000));
	}

	@Test
	@DisplayName("거래종류를 빈 문자열로 수정하려 하면 400 VALIDATION")
	void updateRejectsBlankTradeType() throws Exception {
		String regDate = createListing(authCookie);

		mvc.perform(patch("/api/v1/listings/" + userId + "/" + regDate).cookie(authCookie)
				.contentType(MediaType.APPLICATION_JSON).content("{\"tradeType\":\"   \"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.tradeType").isString());
	}

	@Test
	@DisplayName("본인 매물을 삭제하면 204, 다시 조회하면 404")
	void ownerCanDelete() throws Exception {
		String regDate = createListing(authCookie);

		mvc.perform(delete("/api/v1/listings/" + userId + "/" + regDate).cookie(authCookie))
			.andExpect(status().isNoContent());
		mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate)).andExpect(status().isNotFound());
	}

	@Test
	@DisplayName("다른 사용자의 매물을 삭제하려 하면 403이고 실제로 지워지지 않는다")
	void othersCannotDelete() throws Exception {
		String regDate = createListing(authCookie);

		mvc.perform(delete("/api/v1/listings/" + userId + "/" + regDate).cookie(otherUserCookie()))
			.andExpect(status().isForbidden());
		mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate)).andExpect(status().isOk());
	}

	@Test
	@DisplayName("없는 매물을 삭제하려 하면 404")
	void deleteMissingIsNotFound() throws Exception {
		mvc.perform(delete("/api/v1/listings/" + UUID.randomUUID() + "/20260101000000").cookie(authCookie))
			.andExpect(status().isNotFound());
	}

	@Test
	@DisplayName("로그인 없이 삭제하면 401")
	void deleteRequiresAuth() throws Exception {
		mvc.perform(delete("/api/v1/listings/" + UUID.randomUUID() + "/20260101000000"))
			.andExpect(status().isUnauthorized());
	}

}
