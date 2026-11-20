package com.company.market.devtools;

import java.io.ByteArrayOutputStream;
import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 로컬 전용 임시 테이블 관리 API (계획 2026-10-30-dev-table-admin.md). 테스트 프로필은 app.env=local */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DevTableApiTest {

	static final String TABLE = "trd_ctgr_code";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@BeforeEach
	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_ctgr_code where category_code like 'ZZ%'");
		jdbc.update("delete from trd_user_info where user_id = 'devtooluser'");
	}

	private static String row(String code, String name) {
		return "{\"category_code\":\"%s\",\"category_name\":\"%s\",\"category_depth\":\"일반\",\"category_class\":\"소\",\"reg_date\":\"20261030000000\"}"
			.formatted(code, name);
	}

	private int count(String code) {
		return jdbc.queryForObject("select count(*) from trd_ctgr_code where category_code = ?", Integer.class, code);
	}

	@Test
	@DisplayName("테이블 목록은 화이트리스트 8개와 컬럼·PK 를 돌려준다")
	void lists_tables() throws Exception {
		mvc.perform(get("/api/v1/dev/tables")).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.tables[*].name", hasItem(TABLE)))
			.andExpect(jsonPath("$.data.tables.length()").value(8))
			.andExpect(jsonPath("$.data.tables[?(@.name=='trd_ctgr_code')].primaryKey[0]").value("category_code"));
	}

	@Test
	@DisplayName("생성 → 조회 → 수정 → 삭제")
	void crud() throws Exception {
		mvc.perform(post("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON).content(row("ZZ1", "임시")))
			.andExpect(status().isOk());
		assertThat(count("ZZ1")).isEqualTo(1);

		mvc.perform(get("/api/v1/dev/tables/{t}/rows", TABLE).param("limit", "1000")).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rows[?(@.category_code=='ZZ1')].category_name").value("임시"));

		mvc.perform(put("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON)
			.content("{\"key\":{\"category_code\":\"ZZ1\"},\"values\":{\"category_name\":\"바뀜\",\"sort_order\":7}}"))
			.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select category_name from trd_ctgr_code where category_code='ZZ1'", String.class)).isEqualTo("바뀜");
		assertThat(jdbc.queryForObject("select sort_order from trd_ctgr_code where category_code='ZZ1'", Integer.class)).isEqualTo(7);

		mvc.perform(delete("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON)
			.content("{\"category_code\":\"ZZ1\"}")).andExpect(status().isOk());
		assertThat(count("ZZ1")).isZero();
	}

	@Test
	@DisplayName("없는 행 수정·삭제는 404, 키가 PK 와 다르면 400")
	void missing_row_and_bad_key() throws Exception {
		mvc.perform(put("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON)
			.content("{\"key\":{\"category_code\":\"ZZ9\"},\"values\":{\"category_name\":\"x\"}}")).andExpect(status().isNotFound());
		mvc.perform(delete("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON)
			.content("{\"category_code\":\"ZZ9\"}")).andExpect(status().isNotFound());
		mvc.perform(delete("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON)
			.content("{\"category_name\":\"x\"}")).andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("화이트리스트 밖 테이블·모르는 컬럼은 400/404 — SQL 에 이어 붙이지 않는다")
	void rejects_unknown_table_and_column() throws Exception {
		mvc.perform(get("/api/v1/dev/tables/{t}/rows", "flyway_schema_history")).andExpect(status().isNotFound());
		mvc.perform(get("/api/v1/dev/tables/{t}/rows", "trd_ctgr_code; drop table x")).andExpect(status().is4xxClientError());
		mvc.perform(post("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON)
			.content("{\"nope\":\"x\"}")).andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("제약 위반(PK 중복)은 400 과 사유를 돌려준다")
	void constraint_violation() throws Exception {
		String body = row("ZZ1", "a");
		mvc.perform(post("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isOk());
		mvc.perform(post("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.ok").value(false));
	}

	@Test
	@DisplayName("조회 응답의 password 는 ***, 수정에서 ***를 되돌려 보내도 비밀번호는 안 바뀐다")
	void masks_password() throws Exception {
		users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("devtooluser").passwordHash("$2a$12$realhash")
			.nickname("dev").nicknameUsage("Y").email("devtool@example.com").name("홍길동").phone("01044440001")
			.phoneHash(hasher.hash("01044440001")).build());
		mvc.perform(get("/api/v1/dev/tables/{t}/rows", "trd_user_info").param("limit", "1000")).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rows[?(@.user_id=='devtooluser')].password").value("***"));

		mvc.perform(put("/api/v1/dev/tables/{t}/rows", "trd_user_info").contentType(MediaType.APPLICATION_JSON)
			.content("{\"key\":{\"uid\":\"%s\"},\"values\":{\"password\":\"***\",\"user_nickname\":\"바뀜\"}}".formatted(
					jdbc.queryForObject("select uid::text from trd_user_info where user_id='devtooluser'", String.class))))
			.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("select password from trd_user_info where user_id='devtooluser'", String.class))
			.isEqualTo("$2a$12$realhash");
	}

	@Autowired
	PasswordEncoder passwordEncoder;

	@Test
	@DisplayName("등록일시는 어떤 구분 문자로 와도 14자리로 저장하고, 조회는 2026-10-14 13:44 (초가 있으면 :ss) 로 보인다")
	void normalizesAndDisplaysDateTime() throws Exception {
		String[][] cases = { { "ZZD1", " 2026-10-14 13:44 ", "20261014134400", "2026-10-14 13:44" },
				{ "ZZD2", "2026/03/03 11:11:11", "20260303111111", "2026-03-03 11:11:11" }, { "ZZD3", "2026-03-03", "20260303000000", "2026-03-03 00:00" },
				{ "ZZD4", "26-11-12 1:12:12 PM", "20261112131212", "2026-11-12 13:12:12" },
				{ "ZZD5", "26-11-12 12:05 AM", "20261112000500", "2026-11-12 00:05" },
				{ "ZZD6", "2026-3-3 9:05 am", "20260303090500", "2026-03-03 09:05" },
				{ "ZZD7", "26/11/12 12:30 pm", "20261112123000", "2026-11-12 12:30" } };
		for (String[] c : cases) {
			String body = "{\"category_code\":\"%s\",\"category_name\":\"n\",\"category_depth\":\"일반\",\"category_class\":\"소\",\"reg_date\":\"%s\"}"
				.formatted(c[0], c[1]);
			mvc.perform(post("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
			assertThat(jdbc.queryForObject("select reg_date from trd_ctgr_code where category_code = ?", String.class, c[0])).isEqualTo(c[2]);
			mvc.perform(get("/api/v1/dev/tables/{t}/rows", TABLE).param("limit", "1000")).andExpect(status().isOk())
				.andExpect(jsonPath("$.data.rows[?(@.category_code=='%s')].reg_date".formatted(c[0])).value(c[3]));
		}
	}

	@Test
	@DisplayName("등록일시에 글자가 섞이거나 없는 날짜면 400 — 조용히 고치지 않는다")
	void rejectsBadDateTime() throws Exception {
		for (String bad : new String[] { "2026-10-1a 13:44", "2026-13-45", "2026-10", "26-11-12 13:00 PM", "26-11-12 0:30 AM", "26-13-12 1:00 PM" }) {
			String body = "{\"category_code\":\"ZZD9\",\"category_name\":\"n\",\"category_depth\":\"일반\",\"category_class\":\"소\",\"reg_date\":\"%s\"}".formatted(bad);
			mvc.perform(post("/api/v1/dev/tables/{t}/rows", TABLE).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
		}
		assertThat(count("ZZD9")).isZero();
	}

	@Test
	@DisplayName("password 에 평문을 넣으면 bcrypt 로 바꿔 저장하고, 이미 bcrypt 해시면 그대로 저장한다")
	void hashes_plain_password_only() throws Exception {
		users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("devhashuser").passwordHash("$2a$12$realhash")
			.nickname("dev").nicknameUsage("Y").email("devhash@example.com").name("홍길동").phone("01044440002")
			.phoneHash(hasher.hash("01044440002")).build());
		String uid = jdbc.queryForObject("select uid::text from trd_user_info where user_id='devhashuser'", String.class);

		putPassword(uid, "Plain-pass1!");
		String stored = jdbc.queryForObject("select password from trd_user_info where user_id='devhashuser'", String.class);
		assertThat(stored).isNotEqualTo("Plain-pass1!");
		assertThat(passwordEncoder.matches("Plain-pass1!", stored)).isTrue();

		String ready = passwordEncoder.encode("ready-made");
		putPassword(uid, ready);
		assertThat(jdbc.queryForObject("select password from trd_user_info where user_id='devhashuser'", String.class)).isEqualTo(ready);
	}

	private void putPassword(String uid, String password) throws Exception {
		mvc.perform(put("/api/v1/dev/tables/{t}/rows", "trd_user_info").contentType(MediaType.APPLICATION_JSON)
			.content("{\"key\":{\"uid\":\"%s\"},\"values\":{\"password\":\"%s\"}}".formatted(uid, password))).andExpect(status().isOk());
	}

	// ---- 엑셀 ----

	private static MockMultipartFile xlsx(Object[][]... sheets) throws Exception {
		return xlsxNamed(null, sheets);
	}

	/** 시트마다 {이름, 행...} 이 아니라: names[i] 시트에 sheets[i] 행들 (1행 = 헤더) */
	private static MockMultipartFile xlsxNamed(String[] names, Object[][]... sheets) throws Exception {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			for (int i = 0; i < sheets.length; i++) {
				Sheet sh = wb.createSheet(names == null ? "Sheet" + (i + 1) : names[i]);
				for (int r = 0; r < sheets[i].length; r++) {
					Row row = sh.createRow(r);
					for (int c = 0; c < sheets[i][r].length; c++) {
						Object v = sheets[i][r][c];
						if (v instanceof Number n) {
							row.createCell(c).setCellValue(n.doubleValue());
						}
						else if (v != null) {
							row.createCell(c).setCellValue(v.toString());
						}
					}
				}
			}
			wb.write(out);
			return new MockMultipartFile("file", "t.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());
		}
	}

	private static final Object[] HEADER = { "CATEGORY_CODE", "category_name", "category_depth", "category_class", "reg_date", "sort_order" };

	@Test
	@DisplayName("테이블 1개 불러오기: 첫 시트를 넣는다(헤더 대소문자 무시, 숫자 셀→정수/문자열, 빈 셀 null)")
	void imports_one_table() throws Exception {
		MockMultipartFile f = xlsx(new Object[][] { HEADER,
				{ "ZZ1", "가", "일반", "소", 20261030000000L, 3 },
				{ "ZZ2", "나", "일반", "소", "20261030000000", null } });
		mvc.perform(multipart("/api/v1/dev/tables/{t}/import", TABLE).file(f)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].inserted").value(2));
		assertThat(jdbc.queryForObject("select reg_date from trd_ctgr_code where category_code='ZZ1'", String.class)).isEqualTo("20261030000000");
		assertThat(jdbc.queryForObject("select sort_order from trd_ctgr_code where category_code='ZZ1'", Integer.class)).isEqualTo(3);
		assertThat(jdbc.queryForObject("select sort_order from trd_ctgr_code where category_code='ZZ2'", Integer.class)).isNull();
	}

	@Test
	@DisplayName("중복 PK 한 행이라도 있으면 전체 롤백하고 몇 번째 행인지 알려 준다")
	void import_rolls_back_whole_file() throws Exception {
		MockMultipartFile f = xlsx(new Object[][] { HEADER,
				{ "ZZ1", "가", "일반", "소", "20261030000000", 1 },
				{ "ZZ1", "중복", "일반", "소", "20261030000000", 2 } });
		mvc.perform(multipart("/api/v1/dev/tables/{t}/import", TABLE).file(f)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("3행")));
		assertThat(count("ZZ1")).isZero();
	}

	@Test
	@DisplayName("모르는 헤더 컬럼은 거절")
	void import_unknown_header() throws Exception {
		MockMultipartFile f = xlsx(new Object[][] { { "category_code", "bogus" }, { "ZZ1", "x" } });
		mvc.perform(multipart("/api/v1/dev/tables/{t}/import", TABLE).file(f)).andExpect(status().isBadRequest());
		assertThat(count("ZZ1")).isZero();
	}

	@Test
	@DisplayName("전체 불러오기: 시트 이름이 테이블. 화이트리스트 밖 시트가 있으면 아무것도 안 넣는다")
	void import_all_sheets() throws Exception {
		Object[][] ok = { HEADER, { "ZZ1", "가", "일반", "소", "20261030000000", 1 } };
		MockMultipartFile good = xlsxNamed(new String[] { "trd_ctgr_code" }, ok);
		mvc.perform(multipart("/api/v1/dev/import").file(good)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].table").value("trd_ctgr_code"))
			.andExpect(jsonPath("$.data.results[0].inserted").value(1));
		assertThat(count("ZZ1")).isEqualTo(1);

		jdbc.update("delete from trd_ctgr_code where category_code like 'ZZ%'");
		Object[][] ok2 = { HEADER, { "ZZ2", "가", "일반", "소", "20261030000000", 1 } };
		MockMultipartFile bad = xlsxNamed(new String[] { "trd_ctgr_code", "flyway_schema_history" }, ok2, new Object[][] { { "a" } });
		mvc.perform(multipart("/api/v1/dev/import").file(bad)).andExpect(status().isBadRequest());
		assertThat(count("ZZ2")).isZero();
	}

	@Test
	@DisplayName("xlsx 가 아닌 파일은 400")
	void import_not_xlsx() throws Exception {
		MockMultipartFile f = new MockMultipartFile("file", "t.xlsx", "application/octet-stream", "not excel".getBytes());
		mvc.perform(multipart("/api/v1/dev/tables/{t}/import", TABLE).file(f)).andExpect(status().isBadRequest());
	}

}
