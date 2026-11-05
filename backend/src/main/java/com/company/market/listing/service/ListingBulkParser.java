package com.company.market.listing.service;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.company.market.common.exception.ValidationException;
import com.company.market.listing.dto.BulkRowDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

/** 다량 등록 엑셀(첫 시트)을 줄로 읽는다. 칸 순서는 HEADER_LABELS 가 단일 원본 — 헤더 이름으로 찾으므로 열 순서가 바뀌어도 읽는다 */
@Component
public class ListingBulkParser {

	/** 한 번에 받는 데이터 줄 수 (계획 2026-11-05) */
	public static final int MAX_ROWS = 200;

	/** 빈 서식만 칠해 둔 시트가 수십만 행을 가리켜도 도는 횟수를 막는 안전 상한 */
	private static final int MAX_SCAN_ROWS = 10_000;

	/** BulkRowDto 칸 순서와 같다. * 는 필수 표시 — 읽을 땐 * 와 공백을 뗀다 */
	public static final List<String> HEADER_LABELS = List.of("상품명*", "제조사*", "분류번호", "상품번호", "카테고리 코드", "상품ID",
			"상품상태*", "단가*", "수량*", "최소주문수량", "주문단위", "제공가능일*", "설명");

	public List<BulkRowDto> parse(InputStream in) {
		try (XSSFWorkbook wb = new XSSFWorkbook(in)) {
			if (wb.getNumberOfSheets() == 0) {
				throw fileError("시트가 없습니다.");
			}
			Sheet sheet = wb.getSheetAt(0);
			Row header = sheet.getRow(0);
			if (header == null) {
				throw fileError("1행(헤더)이 없습니다. 양식을 내려받아 사용해 주세요.");
			}
			int[] columns = columnIndexes(header);
			if (sheet.getLastRowNum() > MAX_SCAN_ROWS) {
				throw fileError("행이 너무 많습니다. 데이터는 " + MAX_ROWS + "줄까지 올릴 수 있어요.");
			}
			List<BulkRowDto> rows = new ArrayList<>();
			for (int r = 1; r <= sheet.getLastRowNum(); r++) {
				Row row = sheet.getRow(r);
				if (row == null) {
					continue;
				}
				String[] v = new String[columns.length];
				boolean any = false;
				for (int i = 0; i < columns.length; i++) {
					v[i] = cellText(row.getCell(columns[i]));
					any |= v[i] != null;
				}
				if (!any) {
					continue;
				}
				if (rows.size() == MAX_ROWS) {
					throw fileError("한 번에 " + MAX_ROWS + "줄까지 올릴 수 있어요.");
				}
				// HEADER_LABELS 순서(상품명…설명)를 DTO 순서(상품ID가 앞)로
				rows.add(new BulkRowDto(r + 1, v[5], v[0], v[1], v[2], v[3], v[4], v[6], v[7], v[8], v[9], v[10], v[11], v[12]));
			}
			return rows;
		}
		catch (ValidationException e) {
			throw e;
		}
		catch (IOException | RuntimeException e) {
			throw fileError("엑셀(.xlsx) 파일을 읽을 수 없습니다.");
		}
	}

	/** HEADER_LABELS 각 칸이 있는 열 번호. 하나라도 없으면 양식이 아니다 */
	private static int[] columnIndexes(Row header) {
		Map<String, Integer> byName = new HashMap<>();
		for (int c = 0; c < header.getLastCellNum(); c++) {
			String text = cellText(header.getCell(c));
			if (text != null) {
				byName.putIfAbsent(normalize(text), c);
			}
		}
		int[] columns = new int[HEADER_LABELS.size()];
		for (int i = 0; i < columns.length; i++) {
			Integer c = byName.get(normalize(HEADER_LABELS.get(i)));
			if (c == null) {
				throw fileError("헤더 \"" + HEADER_LABELS.get(i).replace("*", "") + "\" 칸이 없습니다. 양식을 내려받아 사용해 주세요.");
			}
			columns[i] = c;
		}
		return columns;
	}

	private static String normalize(String header) {
		return header.replace("*", "").replaceAll("\\s+", "");
	}

	/** 셀을 글자로. 숫자는 지수·뒤 0 없이("1000.0" → "1000"), 날짜 서식 셀은 YYYY-MM-DD, 빈 칸은 null */
	private static String cellText(Cell cell) {
		if (cell == null) {
			return null;
		}
		CellType type = cell.getCellType() == CellType.FORMULA ? cell.getCachedFormulaResultType() : cell.getCellType();
		String text = switch (type) {
			case STRING -> cell.getStringCellValue();
			case NUMERIC -> DateUtil.isCellDateFormatted(cell)
				? cell.getLocalDateTimeCellValue().toLocalDate().toString()
				: BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
			case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
			default -> null;
		};
		return text == null || text.isBlank() ? null : text.trim();
	}

	private static ValidationException fileError(String message) {
		return new ValidationException(Map.of("file", message));
	}

}
