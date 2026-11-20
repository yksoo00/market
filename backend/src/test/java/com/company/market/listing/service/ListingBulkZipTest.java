package com.company.market.listing.service;

import com.company.market.TestUids;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.dto.BulkFile;
import com.company.market.listing.dto.BulkParseResponse;
import com.company.market.listing.dto.BulkRowDto;
import com.company.market.listing.dto.BulkRowResult;
import com.company.market.listing.service.ProductService.ProductDraft;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;

/** 엑셀 다량 등록 + ZIP 첨부 (계획 2026-11-18-bulk-listing-zip.md 작업 4) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ListingBulkZipTest {

	private static final String CATEGORY = "P01-Q01-R001";

	private static final byte[] JPG = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1 };

	private static final byte[] PDF = "%PDF-1.7\n%test".getBytes(StandardCharsets.US_ASCII);

	@Autowired
	ProductService products;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	JdbcTemplate jdbc;

	/** 실제 빈 — 확정은 트랜잭션 안에서만 업로드 키를 선점하므로 프록시가 필요하다 */
	@Autowired
	ListingBulkService service;

	String sellerId;

	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("bulkzip")
			.passwordHash("$2a$12$hash").nickname("bulkzip").email("bulkzip@example.com")
			.name("홍길동").phone("01077770125").phoneHash(hasher.hash("01077770125")).build()).getId();
		products.findOrCreate(new ProductDraft(CategoryFragments.parse(CATEGORY), "압축 스위치", null, "Cisco",
				null, null, null, null, null, "master-sheet.pdf", "public/listings/photos/2026/10/master.jpg"));
		products.findOrCreate(new ProductDraft(CategoryFragments.parse(CATEGORY), "압축 라우터", null, "Cisco",
				null, null, null, null, null, null, null));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id in (select uid from trd_user_info where user_id = 'bulkzip')");
		jdbc.update("delete from trd_prod_master where prod_name like '압축 %'");
		jdbc.update("delete from trd_user_info where user_id = 'bulkzip'");
	}

	/** 한 줄 = 상품명, 제조사, 사진1~4, 데이터시트 이름. 나머지 칸은 통과하는 값 */
	private static MockMultipartFile excel(Object[]... lines) throws IOException {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("양식");
			Row header = sheet.createRow(0);
			List<String> labels = java.util.stream.Stream.concat(ListingBulkParser.HEADER_LABELS.stream(), ListingBulkParser.FILE_LABELS.stream()).toList();
			for (int c = 0; c < labels.size(); c++) {
				header.createCell(c).setCellValue(labels.get(c));
			}
			for (int r = 0; r < lines.length; r++) {
				Object[] l = lines[r];
				Row row = sheet.createRow(r + 1);
				// 상품명*, 제조사*, 분류번호, 상품번호, 카테고리 코드, 상품ID, 상품상태*, 단가*, 수량*, 최소주문수량, 주문단위, 제공가능일*, 설명
				String[] base = { (String) l[0], (String) l[1], null, null, null, null, "신품", "1000", "3", null, null, "2099-12-31", null };
				for (int c = 0; c < base.length; c++) {
					if (base[c] != null) {
						row.createCell(c).setCellValue(base[c]);
					}
				}
				for (int k = 2; k < l.length; k++) {
					if (l[k] != null) {
						row.createCell(base.length + k - 2).setCellValue((String) l[k]);
					}
				}
			}
			wb.write(out);
			return new MockMultipartFile("file", "양식.xlsx", "application/octet-stream", out.toByteArray());
		}
	}

	private static MockMultipartFile zip(Object... nameAndContent) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (ZipOutputStream z = new ZipOutputStream(out)) {
			for (int i = 0; i < nameAndContent.length; i += 2) {
				z.putNextEntry(new ZipEntry((String) nameAndContent[i]));
				z.write((byte[]) nameAndContent[i + 1]);
				z.closeEntry();
			}
		}
		return new MockMultipartFile("attachments", "files.zip", "application/zip", out.toByteArray());
	}

	private static Object[] line(String name, String photo1, String photo2, String sheet) {
		return new Object[] { name, "Cisco", photo1, photo2, null, null, sheet };
	}

	@Test
	@DisplayName("ZIP 이 없으면 파일 칸은 비워도 지금처럼 통과하고, 이름만 적으면 칸 오류")
	void withoutZip() throws IOException {
		BulkParseResponse ok = service.parse(sellerId, excel(line("압축 스위치", null, null, null)), null);
		BulkParseResponse named = service.parse(sellerId, excel(line("압축 스위치", "a.jpg", null, null)), null);

		assertThat(ok.results().get(0).fields()).isEmpty();
		assertThat(named.results().get(0).fields()).containsKey("photo1");
	}

	@Test
	@DisplayName("엑셀 칸의 이름과 ZIP 안 이름이 같으면 키가 붙고 확정하면 매물에 저장된다 (대소문자 무시)")
	void attachesAndCommits() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId,
				excel(line("압축 스위치", "A1.JPG", "b.jpg", "spec.pdf")),
				zip("a1.jpg", JPG, "b.jpg", JPG, "spec.pdf", PDF, "unused.jpg", JPG));

		BulkRowDto row = parsed.rows().get(0);
		assertThat(parsed.results().get(0).fields()).isEmpty();
		assertThat(parsed.results().get(0).notices()).isEmpty();
		assertThat(row.photo1().key()).startsWith("public/listings/photos/");
		assertThat(row.photo2().key()).startsWith("public/listings/photos/");
		assertThat(row.dataSheet().key()).startsWith("private/listings/datasheets/");

		service.commit(sellerId, parsed.rows());

		Map<String, Object> saved = jdbc.queryForMap(
				"select prod_photo_1, prod_photo_2, prod_photo_3, prod_data_sheet from trd_prod_reg where user_id = ?", sellerId);
		assertThat(saved.get("prod_photo_1")).isEqualTo(row.photo1().key());
		assertThat(saved.get("prod_photo_2")).isEqualTo(row.photo2().key());
		assertThat(saved.get("prod_photo_3")).isNull();
		assertThat(saved.get("prod_data_sheet")).isEqualTo(row.dataSheet().key());
	}

	@Test
	@DisplayName("ZIP 에 이 줄의 파일이 없으면 마스터 사진·데이터시트를 그대로 쓴다")
	void fallsBackToMasterFiles() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId, excel(line("압축 스위치", null, null, null)), zip("x.jpg", JPG));

		service.commit(sellerId, parsed.rows());

		Map<String, Object> saved = jdbc.queryForMap("select prod_photo_1, prod_data_sheet from trd_prod_reg where user_id = ?", sellerId);
		assertThat(saved.get("prod_photo_1")).isEqualTo("public/listings/photos/2026/10/master.jpg");
		assertThat(saved.get("prod_data_sheet")).isEqualTo("master-sheet.pdf");
	}

	@Test
	@DisplayName("엑셀에 적은 이름이 ZIP 에 없으면 그 칸 오류")
	void missingInZip() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId, excel(line("압축 스위치", "nothing.jpg", null, null)), zip("x.jpg", JPG));

		assertThat(parsed.results().get(0).status()).isEqualTo(BulkRowResult.Status.FAILED);
		assertThat(parsed.results().get(0).fields().get("photo1")).contains("ZIP");
	}

	@Test
	@DisplayName("사진 칸에 pdf, 데이터시트 칸에 jpg 를 적으면 형식 오류")
	void wrongKinds() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId, excel(line("압축 스위치", "a.pdf", null, "b.jpg")), zip("a.pdf", PDF, "b.jpg", JPG));

		assertThat(parsed.results().get(0).fields()).containsKeys("photo1", "dataSheet");
	}

	@Test
	@DisplayName("확장자는 jpg 인데 내용이 jpg 가 아니면 형식 오류, 저장하지 않는다")
	void badContent() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId, excel(line("압축 스위치", "a.jpg", null, null)), zip("a.jpg", new byte[] { 1, 2, 3, 4 }));

		assertThat(parsed.results().get(0).fields()).containsKey("photo1");
		assertThat(parsed.rows().get(0).photo1().key()).isNull();
	}

	@Test
	@DisplayName("같은 파일 이름을 두 줄이 써도 줄마다 따로 저장돼 키가 다르다")
	void sameNameTwoRowsGetSeparateKeys() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId,
				excel(line("압축 스위치", "a.jpg", null, null), line("압축 라우터", "a.jpg", null, null)), zip("a.jpg", JPG));

		assertThat(parsed.results()).allSatisfy(r -> assertThat(r.fields()).isEmpty());
		assertThat(parsed.rows().get(0).photo1().key()).isNotEqualTo(parsed.rows().get(1).photo1().key());
		assertThat(service.commit(sellerId, parsed.rows())).isEqualTo(2);
	}

	@Test
	@DisplayName("남이 올린 키를 본문에 넣어 확정하면 400 이고 하나도 저장되지 않는다")
	void foreignKeyRejected() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId, excel(line("압축 스위치", "a.jpg", null, null)), zip("a.jpg", JPG));
		String other = TestUids.random();

		assertThatThrownBy(() -> service.commit(other, parsed.rows())).isInstanceOf(ValidationException.class);
		assertThat(jdbc.queryForObject("select count(*) from trd_prod_reg where user_id = ?", Integer.class, sellerId)).isZero();
	}

	@Test
	@DisplayName("같은 키를 두 줄에 넣으면 둘째 줄 칸 오류")
	void sameKeyTwiceRejected() throws IOException {
		BulkParseResponse parsed = service.parse(sellerId, excel(line("압축 스위치", "a.jpg", null, null)), zip("a.jpg", JPG));
		BulkFile shared = parsed.rows().get(0).photo1();
		BulkRowDto first = parsed.rows().get(0);
		BulkRowDto second = new BulkRowDto(3, null, "압축 라우터", "Cisco", null, null, null, "신품", "1000", "3", null, null, "2099-12-31", null,
				shared, null, null, null, null);

		List<BulkRowResult> results = service.check(sellerId, List.of(first, second));

		assertThat(results.get(0).fields()).isEmpty();
		assertThat(results.get(1).fields()).containsKey("photo1");
	}

	@Test
	@DisplayName("빈 ZIP 은 조용히 넘기지 않고 attachments 오류")
	void emptyZipRejected() throws IOException {
		assertThatThrownBy(() -> service.parse(sellerId, excel(line("압축 스위치", "a.jpg", null, null)),
				new MockMultipartFile("attachments", "files.zip", "application/zip", new byte[0])))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("attachments"));
	}

	@Test
	@DisplayName("엑셀이 10MB 를 넘으면 file 오류 — multipart 바깥 상한이 50MB 라 서비스가 막는다")
	void oversizedExcelRejected() {
		MockMultipartFile big = new MockMultipartFile("file", "big.xlsx", "application/octet-stream", new byte[(int) ListingBulkParser.MAX_FILE_BYTES + 1]);

		assertThatThrownBy(() -> service.parse(sellerId, big, null))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields().get("file")).contains("10MB"));
	}

	@Test
	@DisplayName("ZIP 이 아니거나 폴더가 든 ZIP 은 attachments 오류")
	void badArchive() throws IOException {
		assertThatThrownBy(() -> service.parse(sellerId, excel(line("압축 스위치", "a.jpg", null, null)),
				new MockMultipartFile("attachments", "files.txt", "text/plain", new byte[] { 1 })))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("attachments"));
		assertThatThrownBy(() -> service.parse(sellerId, excel(line("압축 스위치", "a.jpg", null, null)), zip("dir/a.jpg", JPG)))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("attachments"));
	}

}
