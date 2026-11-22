package com.company.market.devtools;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

import com.company.market.TestInfraConfiguration;
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
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 임시 테이블 자동 키·시각 채우기 (계획 2026-11-20-dev-table-auto-keys.md). 서비스를 거치지 않는 대신 서비스 규칙대로 채운다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DevTableAutoKeysTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_trade_history where user_id in (select uid from trd_user_info where user_id like 'adk%')");
		jdbc.update("delete from trd_cart_info where user_id in (select uid from trd_user_info where user_id like 'adk%')");
		jdbc.update("delete from trd_trade_info where user_id in (select uid from trd_user_info where user_id like 'adk%')");
		jdbc.update("delete from trd_prod_reg where user_id in (select uid from trd_user_info where user_id like 'adk%')");
		jdbc.update("delete from trd_prod_master where prod_name like 'adk%'");
		jdbc.update("delete from trd_user_info where user_id like 'adk%'");
	}

	// ---- 폼 한 줄 ----

	@Test
	@DisplayName("사용자: uid·dt_reg·dt_update 는 값이 와도 무시하고 서버가 채운다")
	void userAutoColumns() throws Exception {
		insert("trd_user_info", "{\"uid\":\"UP000000001\",\"user_id\":\"adkuser1\",\"password\":\"x\",\"user_class\":\"personal\",\"user_name\":\"홍\","
				+ "\"dt_reg\":\"2020-01-01 00:00\",\"dt_update\":\"2020-01-01 00:00\"}").andExpect(status().isOk());
		Map<String, Object> row = jdbc.queryForMap("select uid, dt_reg, dt_update from trd_user_info where user_id = 'adkuser1'");
		assertThat((String) row.get("uid")).matches("UP\\d{9}").isNotEqualTo("UP000000001");
		assertThat((String) row.get("dt_reg")).hasSize(14).isGreaterThan("20261101000000");
		assertThat(row.get("dt_update")).isEqualTo(row.get("dt_reg"));
	}

	@Test
	@DisplayName("사용자 수정: dt_update 만 지금으로 바뀌고 dt_reg 는 안 바뀐다")
	void userUpdateTouchesOnlyDtUpdate() throws Exception {
		insert("trd_user_info", userJson("adkuser2")).andExpect(status().isOk());
		String uid = jdbc.queryForObject("select uid from trd_user_info where user_id = 'adkuser2'", String.class);
		jdbc.update("update trd_user_info set dt_reg = '20200101000000', dt_update = '20200101000000' where uid = ?", uid);

		mvc.perform(put("/api/v1/dev/tables/{t}/rows", "trd_user_info").contentType(MediaType.APPLICATION_JSON)
			.content("{\"key\":{\"uid\":\"%s\"},\"values\":{\"user_name\":\"바뀜\",\"dt_reg\":\"2019-01-01\",\"dt_update\":\"2019-01-01\"}}".formatted(uid)))
			.andExpect(status().isOk());

		Map<String, Object> row = jdbc.queryForMap("select dt_reg, dt_update, user_name from trd_user_info where uid = ?", uid);
		assertThat(row.get("user_name")).isEqualTo("바뀜");
		assertThat(row.get("dt_reg")).isEqualTo("20200101000000");
		assertThat((String) row.get("dt_update")).isGreaterThan("20261101000000");
	}

	@Test
	@DisplayName("상품마스터: prod_id 는 KP-연도-6자리로 새로 만들고 reg_date 는 지금")
	void productMasterAutoColumns() throws Exception {
		insert("trd_prod_master", "{\"prod_id\":\"MYID\",\"prod_name\":\"adk상품\",\"reg_date\":\"2020-01-01\"}").andExpect(status().isOk());
		Map<String, Object> row = jdbc.queryForMap("select prod_id, reg_date from trd_prod_master where prod_name = 'adk상품'");
		assertThat((String) row.get("prod_id")).matches("KP-\\d{4}-\\d{6}").isNotEqualTo("MYID");
		assertThat((String) row.get("reg_date")).isGreaterThan("20261101000000");
	}

	@Test
	@DisplayName("폼으로 넣을 때 없는 사용자를 가리키면 400 — 어느 칸의 어떤 값인지 한글로 알려 준다")
	void formRejectsMissingReference() throws Exception {
		insert("trd_prod_reg", "{\"user_id\":\"UP999999999\",\"prod_id\":\"KP-0000-000000\",\"trade_type\":\"등록\",\"prod_state\":\"신품\","
				+ "\"sales_unit_price\":1,\"sales_quantity\":1,\"prov_date\":\"20991231\"}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value(containsString("user_id 'UP999999999' 에 해당하는 사용자이(가) DB에 없습니다.")));
	}

	// ---- 엑셀 여러 시트 ----

	@Test
	@DisplayName("전체 불러오기: 부모 → 자식 순서로 넣고 참조 칸을 새 키에 맞춘다 (장바구니 trade_id = 거래 trade_id, 거래 prod_reg_date = 매물 reg_date)")
	void importAllRewritesReferences() throws Exception {
		MockMultipartFile file = workbook(
				sheet("trd_trade_history", new Object[] { "trade_id", "trade_date", "prod_id", "trade_type", "seller_id", "user_id" },
						new Object[] { "T-OLD", "20261101000000", "PM-OLD", "거래", "S-OLD", "B-OLD" }),
				sheet("trd_cart_info", new Object[] { "user_id", "trade_id", "seller_id", "prod_date", "prod_no", "prod_name", "prod_spec_info", "prod_state",
						"prov_date", "order_unit_price", "order_quantity", "req_deli_date" },
						new Object[] { "B-OLD", "T-OLD", "S-OLD", "20260101120000", "PM-OLD", "상품", "사양", "신품", "20991231", 1000, 1, "20991231" }),
				sheet("trd_trade_info", new Object[] { "user_id", "trade_id", "trade_type", "seller_id", "prod_reg_date", "prod_id", "prov_date",
						"order_unit_price", "order_quantity", "req_deli_date", "trade_stats" },
						new Object[] { "B-OLD", "T-OLD", "거래", "S-OLD", "20260101120000", "PM-OLD", "20991231", 1000, 1, "20991231", "구매요청" }),
				sheet("trd_prod_reg", new Object[] { "user_id", "reg_date", "prod_id", "trade_type", "prod_state", "sales_unit_price", "sales_quantity", "prov_date" },
						new Object[] { "S-OLD", "20260101120000", "PM-OLD", "등록", "신품", 1000, 10, "20991231" }),
				sheet("trd_prod_master", new Object[] { "prod_id", "prod_name" }, new Object[] { "PM-OLD", "adk상품" }),
				sheet("trd_user_info", new Object[] { "uid", "user_id", "password", "user_class", "user_name" },
						new Object[] { "S-OLD", "adkseller", "x", "personal", "판매자" }, new Object[] { "B-OLD", "adkbuyer", "x", "personal", "구매자" }));

		mvc.perform(multipart("/api/v1/dev/import").file(file)).andExpect(status().isOk());

		String seller = uid("adkseller");
		String buyer = uid("adkbuyer");
		String prodId = jdbc.queryForObject("select prod_id from trd_prod_master where prod_name = 'adk상품'", String.class);
		String reg = jdbc.queryForObject("select reg_date from trd_prod_reg where user_id = ?", String.class, seller);
		Map<String, Object> trade = jdbc.queryForMap("select * from trd_trade_info where user_id = ?", buyer);
		assertThat(trade).containsEntry("seller_id", seller).containsEntry("prod_id", prodId).containsEntry("prod_reg_date", reg);
		String tradeId = (String) trade.get("trade_id");
		assertThat(tradeId).isNotEqualTo("T-OLD").matches("\\d{11}");
		Map<String, Object> cart = jdbc.queryForMap("select * from trd_cart_info where user_id = ?", buyer);
		assertThat(cart).containsEntry("trade_id", tradeId).containsEntry("seller_id", seller).containsEntry("prod_no", prodId)
			.containsEntry("prod_date", reg).containsEntry("ser_no", 1);
		Map<String, Object> history = jdbc.queryForMap("select * from trd_trade_history where user_id = ?", buyer);
		assertThat(history).containsEntry("trade_id", tradeId).containsEntry("seller_id", seller).containsEntry("prod_id", prodId);
	}

	@Test
	@DisplayName("전체 불러오기 응답에 옛 키 → 새 키 목록이 담긴다")
	void importAllReturnsKeyLog() throws Exception {
		MockMultipartFile file = workbook(sheet("trd_user_info", new Object[] { "uid", "user_id", "password", "user_class", "user_name" },
				new Object[] { "S-OLD", "adkseller", "x", "personal", "판매자" }));

		mvc.perform(multipart("/api/v1/dev/import").file(file)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].keys[0]").value(containsString("사용자 S-OLD → UP")));
	}

	@Test
	@DisplayName("같은 파일에도 DB에도 없는 참조는 400, 시트·행·칸·값을 한글로 알려 주고 아무것도 저장하지 않는다")
	void importRejectsMissingReference() throws Exception {
		MockMultipartFile file = workbook(
				sheet("trd_user_info", new Object[] { "uid", "user_id", "password", "user_class", "user_name" },
						new Object[] { "S-OLD", "adkseller", "x", "personal", "판매자" }),
				sheet("trd_prod_reg", new Object[] { "user_id", "reg_date", "prod_id", "trade_type", "prod_state", "sales_unit_price", "sales_quantity", "prov_date" },
						new Object[] { "S-OLD", "20260101120000", "PM-없음", "등록", "신품", 1000, 10, "20991231" }));

		mvc.perform(multipart("/api/v1/dev/import").file(file)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value(containsString("시트 trd_prod_reg, 2행: prod_id 'PM-없음' 에 해당하는 상품마스터이(가) 같은 파일에도 DB에도 없습니다.")));
		assertThat(jdbc.queryForObject("select count(*) from trd_user_info where user_id = 'adkseller'", Integer.class)).isZero();
	}

	@Test
	@DisplayName("매물 키가 겹치면(같은 파일에서 같은 판매자·상품) reg_date 를 1초씩 늦춰 둘 다 넣는다")
	void listingSameSecondGetsDifferentReg() throws Exception {
		MockMultipartFile file = workbook(
				sheet("trd_user_info", new Object[] { "uid", "user_id", "password", "user_class", "user_name" },
						new Object[] { "S-OLD", "adkseller", "x", "personal", "판매자" }),
				sheet("trd_prod_master", new Object[] { "prod_id", "prod_name" }, new Object[] { "PM-OLD", "adk상품" }),
				sheet("trd_prod_reg", new Object[] { "user_id", "reg_date", "prod_id", "trade_type", "prod_state", "sales_unit_price", "sales_quantity", "prov_date" },
						new Object[] { "S-OLD", "20260101120001", "PM-OLD", "등록", "신품", 1000, 10, "20991231" },
						new Object[] { "S-OLD", "20260101120002", "PM-OLD", "등록", "신품", 1000, 10, "20991231" }));

		mvc.perform(multipart("/api/v1/dev/import").file(file)).andExpect(status().isOk());

		List<String> regs = jdbc.queryForList("select reg_date from trd_prod_reg where user_id = ? order by reg_date", String.class, uid("adkseller"));
		assertThat(regs).hasSize(2).doesNotHaveDuplicates();
	}

	@Test
	@DisplayName("같은 판매자의 서로 다른 상품 매물도 reg_date 가 겹치지 않는다 — 매물 주소·상세 조회는 (판매자, reg_date) 두 값으로 한 건을 찾는다")
	void listingsOfSameSellerNeverShareRegDate() throws Exception {
		MockMultipartFile file = workbook(
				sheet("trd_user_info", new Object[] { "uid", "user_id", "password", "user_class", "user_name" },
						new Object[] { "S-OLD", "adkseller", "x", "personal", "판매자" }),
				sheet("trd_prod_master", new Object[] { "prod_id", "prod_name" }, new Object[] { "PM-A", "adk상품A" }, new Object[] { "PM-B", "adk상품B" }),
				sheet("trd_prod_reg", new Object[] { "user_id", "reg_date", "prod_id", "trade_type", "prod_state", "sales_unit_price", "sales_quantity", "prov_date" },
						new Object[] { "S-OLD", "20260101120001", "PM-A", "등록", "신품", 1000, 10, "20991231" },
						new Object[] { "S-OLD", "20260101120002", "PM-B", "등록", "신품", 1000, 10, "20991231" }));

		mvc.perform(multipart("/api/v1/dev/import").file(file)).andExpect(status().isOk());

		List<String> regs = jdbc.queryForList("select reg_date from trd_prod_reg where user_id = ? order by reg_date", String.class, uid("adkseller"));
		assertThat(regs).hasSize(2).doesNotHaveDuplicates();
	}

	// ---- 도우미 ----

	private ResultActions insert(String table, String json) throws Exception {
		return mvc.perform(post("/api/v1/dev/tables/{t}/rows", table).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	private static String userJson(String loginId) {
		return "{\"user_id\":\"%s\",\"password\":\"x\",\"user_class\":\"personal\",\"user_name\":\"홍\"}".formatted(loginId);
	}

	private String uid(String loginId) {
		return jdbc.queryForObject("select uid from trd_user_info where user_id = ?", String.class, loginId);
	}

	/** 시트 이름 + 행들 (1행 = 헤더) */
	private static Object[] sheet(String name, Object[]... rows) {
		return new Object[] { name, rows };
	}

	private static MockMultipartFile workbook(Object[]... sheets) throws Exception {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			for (Object[] s : sheets) {
				Sheet sh = wb.createSheet((String) s[0]);
				Object[][] rows = (Object[][]) s[1];
				for (int r = 0; r < rows.length; r++) {
					Row row = sh.createRow(r);
					for (int c = 0; c < rows[r].length; c++) {
						Object v = rows[r][c];
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

}
