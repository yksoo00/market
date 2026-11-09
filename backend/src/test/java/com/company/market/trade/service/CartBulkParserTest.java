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

}
