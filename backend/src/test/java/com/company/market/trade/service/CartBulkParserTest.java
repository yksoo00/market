package com.company.market.trade.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.company.market.common.exception.ValidationException;
import com.company.market.trade.dto.CartBulkRowDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 엑셀 대량구매 양식·파서 (계획 2026-11-09-bulk-purchase-excel.md 작업 2) */
class CartBulkParserTest {

	private final CartBulkParser parser = new CartBulkParser();

	/** 양식과 같은 헤더(또는 주어진 헤더) + 줄. 줄은 헤더 순서대로 칸 값(문자열·숫자·날짜)을 넣는다 */
	private static byte[] workbook(List<String> headers, List<Object[]> rows) throws IOException {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("양식");
			Row h = sheet.createRow(0);
			for (int c = 0; c < headers.size(); c++) {
				h.createCell(c).setCellValue(headers.get(c));
			}
			for (int r = 0; r < rows.size(); r++) {
				Row row = sheet.createRow(r + 1);
				Object[] values = rows.get(r);
				for (int c = 0; c < values.length; c++) {
					if (values[c] instanceof Number n) {
						row.createCell(c).setCellValue(n.doubleValue());
					}
					else if (values[c] instanceof LocalDate d) {
						CellStyle style = wb.createCellStyle();
						style.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("yyyy-mm-dd"));
						Cell cell = row.createCell(c);
						cell.setCellValue(d);
						cell.setCellStyle(style);
					}
					else if (values[c] != null) {
						row.createCell(c).setCellValue(values[c].toString());
					}
				}
			}
			wb.write(out);
			return out.toByteArray();
		}
	}

	/** 상품명, 제조사, 분류번호, 상품ID, 수량, 납품희망일, 요청사항 */
	private static Object[] line(Object name, Object quantity, Object date) {
		return new Object[] { name, "Cisco", null, null, quantity, date, "메모" };
	}

	private List<CartBulkRowDto> parse(byte[] bytes) {
		return parser.parse(new ByteArrayInputStream(bytes));
	}

	@Test
	@DisplayName("양식 헤더대로 읽는다")
	void readsByHeader() throws IOException {
		List<CartBulkRowDto> rows = parse(workbook(CartBulkParser.HEADER_LABELS, List.<Object[]>of(line("스위치 C9300", 3, "2026-12-01"))));

		assertThat(rows).hasSize(1);
		CartBulkRowDto r = rows.get(0);
		assertThat(r.rowNo()).isEqualTo(2);
		assertThat(r.prodName()).isEqualTo("스위치 C9300");
		assertThat(r.prodBrand()).isEqualTo("Cisco");
		assertThat(r.orderQuantity()).isEqualTo("3");
		assertThat(r.reqDeliDate()).isEqualTo("2026-12-01");
		assertThat(r.remarks()).isEqualTo("메모");
		assertThat(r.prodClassNo()).isNull();
		assertThat(r.sellerId()).isNull();
		assertThat(r.regDate()).isNull();
	}

	@Test
	@DisplayName("날짜 셀은 YYYY-MM-DD, 숫자 셀 1000.0 은 \"1000\"")
	void dateAndNumberCells() throws IOException {
		List<CartBulkRowDto> rows = parse(workbook(CartBulkParser.HEADER_LABELS, List.<Object[]>of(line("A", 1000.0, LocalDate.of(2026, 12, 5)))));

		assertThat(rows.get(0).orderQuantity()).isEqualTo("1000");
		assertThat(rows.get(0).reqDeliDate()).isEqualTo("2026-12-05");
	}

	@Test
	@DisplayName("완전히 빈 줄은 건너뛰고 rowNo 는 엑셀 행 번호다")
	void skipsBlankRows() throws IOException {
		List<CartBulkRowDto> rows = parse(workbook(CartBulkParser.HEADER_LABELS,
				List.of(line("A", 1, "2026-12-01"), new Object[] {}, line("B", 2, "2026-12-01"))));

		assertThat(rows).extracting(CartBulkRowDto::rowNo).containsExactly(2, 4);
	}

	@Test
	@DisplayName("헤더 순서가 바뀌어도 이름으로 읽는다")
	void reorderedHeaders() throws IOException {
		List<String> reversed = new ArrayList<>(CartBulkParser.HEADER_LABELS);
		Collections.reverse(reversed);
		Object[] row = line("A", 1, "2026-12-01");
		Object[] reversedRow = new Object[row.length];
		for (int i = 0; i < row.length; i++) {
			reversedRow[row.length - 1 - i] = row[i];
		}

		List<CartBulkRowDto> rows = parse(workbook(reversed, List.<Object[]>of(reversedRow)));

		assertThat(rows.get(0).prodName()).isEqualTo("A");
		assertThat(rows.get(0).reqDeliDate()).isEqualTo("2026-12-01");
	}

	@Test
	@DisplayName("헤더가 빠졌으면 ValidationException(file)")
	void missingHeader() throws IOException {
		List<String> headers = CartBulkParser.HEADER_LABELS.subList(1, CartBulkParser.HEADER_LABELS.size());

		assertThatThrownBy(() -> parse(workbook(headers, List.of())))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("file"));
	}

	@Test
	@DisplayName("데이터 101줄이면 거절한다 (장바구니 최대 100줄)")
	void tooManyRows() throws IOException {
		List<Object[]> rows = new ArrayList<>();
		for (int i = 0; i < 101; i++) {
			rows.add(line("상품" + i, 1, "2026-12-01"));
		}

		assertThatThrownBy(() -> parse(workbook(CartBulkParser.HEADER_LABELS, rows)))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("file"));
	}

	@Test
	@DisplayName("엑셀이 아닌 파일은 ValidationException(file)")
	void notExcel() {
		assertThatThrownBy(() -> parse("not excel".getBytes()))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("file"));
	}

	@Test
	@DisplayName("양식 build() 결과는 파서가 읽을 수 있고 데이터 줄은 비어 있다")
	void templateRoundTrip() {
		assertThat(parse(CartBulkTemplate.build())).isEmpty();
	}

	@Test
	@DisplayName("양식 헤더는 TEMPLATE_LABELS 순서이고, 최소상태·최소보증·증빙 5칸에 드롭다운이 걸린다")
	void templateHeadersAndDropdowns() throws IOException {
		try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(CartBulkTemplate.build()))) {
			Sheet sheet = wb.getSheetAt(0);
			List<String> headers = new ArrayList<>();
			for (Cell cell : sheet.getRow(0)) {
				headers.add(cell.getStringCellValue());
			}
			assertThat(headers).isEqualTo(CartBulkParser.TEMPLATE_LABELS);
			// 최소상태 1 + 최소보증 1 + 증빙 5
			assertThat(sheet.getDataValidations()).hasSize(7);
		}
	}

	/** 양식 전체 열(조건 포함) 순서대로 한 줄: 상품명, 제조사, 수량, 납품희망일, 최소상태, 단가상한, 최소보증, 데이터시트, 사진, 불량지원, 테스트리포트, 정품인증서, 요청사항 */
	@Test
	@DisplayName("조건 칸을 읽는다 — 숫자 셀 6 은 \"6\", 단가 1000.0 은 \"1000\"")
	void readsConditionColumns() throws IOException {
		Object[] row = { "스위치", "Cisco", 3, "2026-12-01", "신품대비 80~89%", 1500000.0, 6, "Y", null, "Y", null, "Y", "메모" };

		CartBulkRowDto r = parse(workbook(CartBulkParser.TEMPLATE_LABELS, List.<Object[]>of(row))).get(0);

		assertThat(r.prodName()).isEqualTo("스위치");
		assertThat(r.remarks()).isEqualTo("메모");
		assertThat(r.minState()).isEqualTo("신품대비 80~89%");
		assertThat(r.maxPrice()).isEqualTo("1500000");
		assertThat(r.minWarrantyMonths()).isEqualTo("6");
		assertThat(r.needDataSheet()).isEqualTo("Y");
		assertThat(r.needPhoto()).isNull();
		assertThat(r.needCoverage()).isEqualTo("Y");
		assertThat(r.needTestReport()).isNull();
		assertThat(r.needCertificate()).isEqualTo("Y");
	}

	@Test
	@DisplayName("조건 열이 없던 옛 양식 파일도 읽힌다 (조건은 모두 비어 있음)")
	void oldTemplateWithoutConditionColumns() throws IOException {
		CartBulkRowDto r = parse(workbook(CartBulkParser.HEADER_LABELS, List.<Object[]>of(line("A", 1, "2026-12-01")))).get(0);

		assertThat(r.minState()).isNull();
		assertThat(r.maxPrice()).isNull();
		assertThat(r.minWarrantyMonths()).isNull();
		assertThat(r.needDataSheet()).isNull();
		assertThat(r.needCertificate()).isNull();
	}

	@Test
	@DisplayName("제조사 헤더의 * 가 있든 없든 읽는다 (옛 양식은 \"제조사*\")")
	void brandHeaderWithOrWithoutStar() throws IOException {
		List<String> oldHeaders = new ArrayList<>(CartBulkParser.HEADER_LABELS);
		oldHeaders.set(1, "제조사*");

		assertThat(parse(workbook(oldHeaders, List.<Object[]>of(line("A", 1, "2026-12-01")))).get(0).prodBrand()).isEqualTo("Cisco");
	}

	@Test
	@DisplayName("조건 칸만 채워진 줄도 데이터 줄로 센다 (그래야 필수 칸 오류가 보인다)")
	void conditionOnlyRowCounts() throws IOException {
		Object[] row = { null, null, null, null, "신품", null, null, null, null, null, null, null, null };

		assertThat(parse(workbook(CartBulkParser.TEMPLATE_LABELS, List.<Object[]>of(row)))).hasSize(1);
	}

	@Test
	@DisplayName("새 양식에는 분류번호·상품ID 칸이 없다 (구매자가 알 수 없는 값)")
	void templateHasNoHiddenColumns() {
		assertThat(CartBulkParser.TEMPLATE_LABELS).doesNotContain("분류번호", "상품ID");
		assertThat(CartBulkParser.TEMPLATE_LABELS).startsWith("상품명*", "제조사", "수량*", "납품희망일*");
	}

	@Test
	@DisplayName("필수(*) 3칸(상품명·수량·납품희망일)만 있는 양식도 읽는다. 제조사·요청사항 헤더가 없어도 거절하지 않는다")
	void readsOnlyRequiredColumns() throws IOException {
		Object[] row = { "스위치", 3, "2026-12-01" };

		CartBulkRowDto r = parse(workbook(List.of("상품명*", "수량*", "납품희망일*"), List.<Object[]>of(row))).get(0);

		assertThat(r.prodName()).isEqualTo("스위치");
		assertThat(r.orderQuantity()).isEqualTo("3");
		assertThat(r.reqDeliDate()).isEqualTo("2026-12-01");
		assertThat(r.prodBrand()).isNull();
		assertThat(r.prodClassNo()).isNull();
		assertThat(r.prodId()).isNull();
		assertThat(r.remarks()).isNull();
	}

	@Test
	@DisplayName("필수 칸 헤더(납품희망일)가 없으면 ValidationException(file)")
	void missingRequiredHeader() throws IOException {
		assertThatThrownBy(() -> parse(workbook(List.of("상품명*", "수량*"), List.of())))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields().get("file")).contains("납품희망일"));
	}

}
