package com.company.market.devtools;

import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.Set;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 임시 테이블 엑셀 불러오기의 정의서 논리명(한글) 별명 (계획 2026-11-04-dev-table-korean-alias.md) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DevTableAliasTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	DevTableService service;

	private static final Set<String> UNALIASED = Set.of("trd_prod_master.prod_mufc_date", "trd_cart_info.mufc_date");

	@BeforeEach
	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_ctgr_code where category_code like 'ZZ%'");
		jdbc.update("delete from trd_ctgr_master where category_code like 'ZZ%'");
	}

	private int count(String table, String code) {
		return jdbc.queryForObject("select count(*) from " + table + " where category_code = ?", Integer.class, code);
	}

	/** names[i] 시트에 sheets[i] 행들 (1행 = 헤더) */
	private static MockMultipartFile xlsx(String[] names, Object[][]... sheets) throws Exception {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			for (int i = 0; i < sheets.length; i++) {
				Sheet sh = wb.createSheet(names[i]);
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

	@Test
	@DisplayName("DB 의 모든 테이블·컬럼에 별명이 있고(제조일 컬럼 둘만 제외) 한 테이블 안에서 이름이 겹치지 않는다")
	void every_column_has_unique_alias() {
		assertThat(DevTableAliases.TABLES.keySet()).containsExactlyInAnyOrderElementsOf(DevTableService.TABLES);
		assertThat(normalized(DevTableAliases.TABLES.values())).hasSize(DevTableService.TABLES.size());
		for (DevTableService.TableInfo t : service.tables()) {
			Set<String> seen = new HashSet<>();
			for (DevTableService.ColumnInfo c : t.columns()) {
				String alias = DevTableAliases.COLUMNS.get(t.name()).get(c.name());
				// 제조일 삭제(2026-11-04) 중 — DB 에서 컬럼을 지우는 db/ PR 에서 이 예외도 지운다
				if (UNALIASED.contains(t.name() + "." + c.name())) {
					assertThat(alias).as("지우는 중인 컬럼은 별명 없이 물리명으로만").isNull();
					continue;
				}
				assertThat(alias).as(t.name() + "." + c.name()).isNotBlank();
				assertThat(seen.add(DevTableAliases.normalize(alias))).as(t.name() + " 별명 중복: " + alias).isTrue();
				assertThat(seen.add(DevTableAliases.normalize(c.name()))).as(t.name() + " 별명이 물리명과 겹침: " + c.name()).isTrue();
			}
			assertThat(DevTableAliases.COLUMNS.get(t.name()).keySet()).as(t.name() + " 별명표에 없는 컬럼이 있다")
				.allMatch(name -> t.columns().stream().anyMatch(c -> c.name().equals(name)));
		}
	}

	private static Set<String> normalized(Iterable<String> names) {
		Set<String> out = new HashSet<>();
		names.forEach(n -> out.add(DevTableAliases.normalize(n)));
		return out;
	}

	@Test
	@DisplayName("전체 불러오기: 시트 이름·헤더를 논리명으로, 물리명과 섞고 공백·대소문자를 틀려도 받는다")
	void import_all_with_logical_names() throws Exception {
		MockMultipartFile f = xlsx(new String[] { "카테고리 코드", "카테고리마스터" },
				new Object[][] { { "카테고리코드", "카테고리명", "카테고리구분", "분류 레벨", "등록일시", "SORT_ORDER" },
						{ "ZZ1", "가", "일반", "소", "20261104000000", 3 } },
				new Object[][] { { "카테고리 코드", "category_name", "분류레벨", "등록 일시" },
						{ "ZZ2", "나", "소", "20261104000000" } });
		mvc.perform(multipart("/api/v1/dev/import").file(f)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].table").value("trd_ctgr_code"))
			.andExpect(jsonPath("$.data.results[1].table").value("trd_ctgr_master"))
			.andExpect(jsonPath("$.data.results[1].inserted").value(1));
		assertThat(count("trd_ctgr_code", "ZZ1")).isEqualTo(1);
		assertThat(jdbc.queryForObject("select sort_order from trd_ctgr_code where category_code='ZZ1'", Integer.class)).isEqualTo(3);
		assertThat(count("trd_ctgr_master", "ZZ2")).isEqualTo(1);
	}

	@Test
	@DisplayName("테이블 1개 불러오기: 시트 이름은 아무거나, 헤더만 논리명")
	void import_one_table_with_logical_headers() throws Exception {
		MockMultipartFile f = xlsx(new String[] { "Sheet1" },
				new Object[][] { { "카테고리코드", "카테고리명", "카테고리구분", "분류레벨", "등록일시" }, { "ZZ1", "가", "일반", "소", "20261104000000" } });
		mvc.perform(multipart("/api/v1/dev/tables/{t}/import", "trd_ctgr_code").file(f)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.results[0].inserted").value(1));
		assertThat(count("trd_ctgr_code", "ZZ1")).isEqualTo(1);
	}

	@Test
	@DisplayName("같은 컬럼을 물리명과 논리명으로 두 번 쓰면 400, 아무것도 안 넣는다")
	void same_column_twice_is_rejected() throws Exception {
		MockMultipartFile f = xlsx(new String[] { "카테고리 코드" },
				new Object[][] { { "category_code", "카테고리코드", "카테고리명", "카테고리구분", "분류레벨", "등록일시" },
						{ "ZZ1", "ZZ1", "가", "일반", "소", "20261104000000" } });
		mvc.perform(multipart("/api/v1/dev/import").file(f)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("두 번")));
		assertThat(count("trd_ctgr_code", "ZZ1")).isZero();
	}

	@Test
	@DisplayName("모르는 논리명 헤더·시트는 400")
	void unknown_logical_names_are_rejected() throws Exception {
		MockMultipartFile badHeader = xlsx(new String[] { "카테고리 코드" },
				new Object[][] { { "카테고리코드", "없는칸" }, { "ZZ1", "x" } });
		mvc.perform(multipart("/api/v1/dev/import").file(badHeader)).andExpect(status().isBadRequest());

		MockMultipartFile badSheet = xlsx(new String[] { "없는 테이블" }, new Object[][] { { "카테고리코드" }, { "ZZ1" } });
		mvc.perform(multipart("/api/v1/dev/import").file(badSheet)).andExpect(status().isBadRequest());
		assertThat(count("trd_ctgr_code", "ZZ1")).isZero();
	}

	@Test
	@DisplayName("물리명이 정의서에서 겹쳤거나 짝이 헷갈리기 쉬운 칸은 DB 컬럼으로 바르게 이어진다")
	void tricky_columns_map_to_the_right_db_column() {
		assertThat(DevTableAliases.column("trd_prod_reg", "제공가능일")).isEqualTo("prov_date");
		assertThat(DevTableAliases.column("trd_prod_reg", "등록일시")).isEqualTo("reg_date");
		assertThat(DevTableAliases.column("trd_trade_info", "상품등록일시")).isEqualTo("prod_reg_date");
		assertThat(DevTableAliases.column("trd_trade_info", "판매자ID")).isEqualTo("seller_id");
		assertThat(DevTableAliases.column("trd_trade_info", "사용자ID")).isEqualTo("user_id");
		assertThat(DevTableAliases.column("trd_cart_info", "상품등록일시")).isEqualTo("prod_date");
		assertThat(DevTableAliases.column("trd_cart_info", "제공가능일")).isEqualTo("prov_date");
		assertThat(DevTableAliases.column("trd_cart_info", "일렬번호")).isEqualTo("ser_no");
		assertThat(DevTableAliases.column("trd_trade_history", "판매자ID")).isEqualTo("seller_id");
		assertThat(DevTableAliases.column("trd_user_info", "개업년원일")).isEqualTo("company_open_date");
		assertThat(DevTableAliases.column("trd_user_info", "시용자ID")).isEqualTo("user_id");
		assertThat(DevTableAliases.column("trd_user_info", "등록 일시")).isEqualTo("dt_reg");
	}

	@Test
	@DisplayName("정의서 CART_INFO 헤더 그대로 \"제조일시\" 칸이 있으면 모르는 컬럼으로 거절한다 — 조용히 버리지 않는다 (제조일 삭제 2026-11-04)")
	void cart_header_with_removed_column_is_rejected() throws Exception {
		MockMultipartFile f = xlsx(new String[] { "바구니 정보" }, new Object[][] { { "사용자ID", "제조일시" }, { "11111111-1111-1111-1111-111111111111", "20260101" } });
		mvc.perform(multipart("/api/v1/dev/import").file(f)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("모르는 컬럼")));
	}

	@Test
	@DisplayName("제조일 컬럼이 아직 DB 에 있는 동안, 별명이 없는 prod_mufc_date 는 물리명으로 받는다")
	void column_without_alias_accepts_physical_name() {
		assertThat(DevTableAliases.column("trd_prod_master", "PROD_MUFC_DATE")).isEqualTo("prod_mufc_date");
	}

	@Test
	@DisplayName("물리명 시트와 논리명 시트가 같은 테이블이면 400, 아무것도 안 넣는다")
	void two_sheets_for_one_table_are_rejected() throws Exception {
		Object[][] a = { { "category_code", "category_name", "category_depth", "category_class", "reg_date" }, { "ZZ1", "가", "일반", "소", "20261104000000" } };
		Object[][] b = { { "카테고리코드", "카테고리명", "카테고리구분", "분류레벨", "등록일시" }, { "ZZ2", "나", "일반", "소", "20261104000000" } };
		mvc.perform(multipart("/api/v1/dev/import").file(xlsx(new String[] { "trd_ctgr_code", "카테고리 코드" }, a, b)))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("두 개")));
		assertThat(count("trd_ctgr_code", "ZZ1")).isZero();
		assertThat(count("trd_ctgr_code", "ZZ2")).isZero();
	}

}
