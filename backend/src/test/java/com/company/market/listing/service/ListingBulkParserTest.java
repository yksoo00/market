package com.company.market.listing.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

import com.company.market.common.exception.ValidationException;
import com.company.market.listing.dto.BulkRowDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 엑셀 다량 등록 양식·파서 (계획 2026-11-05-bulk-listing-excel.md 작업 1) */
class ListingBulkParserTest {

	private final ListingBulkParser parser = new ListingBulkParser();

	/** 양식과 같은 헤더 + 주어진 데이터 줄. 줄은 헤더 순서대로 칸 값(문자열 또는 숫자)을 넣는다 */
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
						CreationHelper helper = wb.getCreationHelper();
						CellStyle style = wb.createCellStyle();
						style.setDataFormat(helper.createDataFormat().getFormat("yyyy-mm-dd"));
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

	private static Object[] line(Object name, Object price, Object date) {
		return new Object[] { name, "Cisco", null, null, "E01-F01-G001", null, "신품", price, 3, null, null, date, "메모" };
	}

	private List<BulkRowDto> parse(byte[] bytes) {
		return parser.parse(new ByteArrayInputStream(bytes));
	}

	@Test
	@DisplayName("파서는 양식 헤더대로 읽는다")
	void readsByHeader() throws IOException {
		List<BulkRowDto> rows = parse(workbook(ListingBulkParser.HEADER_LABELS, List.<Object[]>of(line("스위치 C9300", 500000, "2026-12-01"))));

		assertThat(rows).hasSize(1);
		BulkRowDto r = rows.get(0);
		assertThat(r.rowNo()).isEqualTo(2);
		assertThat(r.prodName()).isEqualTo("스위치 C9300");
		assertThat(r.prodBrand()).isEqualTo("Cisco");
		assertThat(r.categoryCode()).isEqualTo("E01-F01-G001");
		assertThat(r.prodState()).isEqualTo("신품");
		assertThat(r.salesQuantity()).isEqualTo("3");
		assertThat(r.deliveryDate()).isEqualTo("2026-12-01");
		assertThat(r.description()).isEqualTo("메모");
		assertThat(r.prodClassNo()).isNull();
	}

	@Test
	@DisplayName("날짜 셀은 YYYY-MM-DD 문자열이 된다")
	void dateCell() throws IOException {
		List<BulkRowDto> rows = parse(workbook(ListingBulkParser.HEADER_LABELS, List.<Object[]>of(line("A", 1, LocalDate.of(2026, 12, 5)))));

		assertThat(rows.get(0).deliveryDate()).isEqualTo("2026-12-05");
	}

	@Test
	@DisplayName("숫자 셀 1000.0 은 \"1000\" 이 된다")
	void numberCell() throws IOException {
		List<BulkRowDto> rows = parse(workbook(ListingBulkParser.HEADER_LABELS, List.<Object[]>of(line("A", 1000.0, "2026-12-01"))));

		assertThat(rows.get(0).salesUnitPrice()).isEqualTo("1000");
	}

	@Test
	@DisplayName("완전히 빈 줄은 건너뛰고 rowNo 는 엑셀 행 번호다")
	void skipsBlankRows() throws IOException {
		List<BulkRowDto> rows = parse(workbook(ListingBulkParser.HEADER_LABELS,
				List.of(line("A", 1, "2026-12-01"), new Object[] {}, line("B", 2, "2026-12-01"))));

		assertThat(rows).extracting(BulkRowDto::rowNo).containsExactly(2, 4);
	}

	@Test
	@DisplayName("헤더 순서가 바뀌어도 이름으로 읽는다")
	void reorderedHeaders() throws IOException {
		List<String> reversed = new java.util.ArrayList<>(ListingBulkParser.HEADER_LABELS);
		java.util.Collections.reverse(reversed);
		Object[] row = line("A", 1, "2026-12-01");
		Object[] reversedRow = new Object[row.length];
		for (int i = 0; i < row.length; i++) {
			reversedRow[row.length - 1 - i] = row[i];
		}

		List<BulkRowDto> rows = parse(workbook(reversed, List.<Object[]>of(reversedRow)));

		assertThat(rows.get(0).prodName()).isEqualTo("A");
		assertThat(rows.get(0).deliveryDate()).isEqualTo("2026-12-01");
	}

	@Test
	@DisplayName("헤더가 빠졌으면 ValidationException(file)")
	void missingHeader() throws IOException {
		List<String> headers = ListingBulkParser.HEADER_LABELS.subList(1, ListingBulkParser.HEADER_LABELS.size());

		assertThatThrownBy(() -> parse(workbook(headers, List.of())))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("file"));
	}

	@Test
	@DisplayName("데이터 201줄이면 거절한다")
	void tooManyRows() throws IOException {
		List<Object[]> rows = new java.util.ArrayList<>();
		for (int i = 0; i < 201; i++) {
			rows.add(line("상품" + i, 1, "2026-12-01"));
		}

		assertThatThrownBy(() -> parse(workbook(ListingBulkParser.HEADER_LABELS, rows)))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("file"));
	}

	@Test
	@DisplayName("엑셀이 아닌 파일은 ValidationException(file)")
	void notExcel() {
		assertThatThrownBy(() -> parse("not excel".getBytes()))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("file"));
	}

	@Test
	@DisplayName("양식 build() 결과는 파서가 읽을 수 있고 데이터 줄은 비어 있다 (예시 줄을 두면 지우지 않은 채 올라온다)")
	void templateRoundTrip() {
		assertThat(parse(ListingBulkTemplate.build())).isEmpty();
	}

}
