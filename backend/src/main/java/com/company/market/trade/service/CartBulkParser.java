package com.company.market.trade.service;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.company.market.common.exception.ValidationException;
import com.company.market.trade.dto.CartBulkRowDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

/**
 * 대량구매 엑셀(첫 시트)을 줄로 읽는다. 칸 순서는 HEADER_LABELS 가 단일 원본 — 헤더 이름으로 찾으므로 열 순서가 바뀌어도 읽는다.
 * 셀 변환(숫자 1000.0 → "1000", 날짜 셀 → YYYY-MM-DD)은 판매 다량 등록의 ListingBulkParser 와 같다 — 판매 코드를 건드리지 않으려고 따로 둔다
 */
@Component
public class CartBulkParser {

	/** 한 번에 받는 데이터 줄 수 — 장바구니 최대 100줄(CartService.MAX_ITEMS)과 맞춘다 */
	public static final int MAX_ROWS = 100;

	/**
	 * 읽을 수 있는 헤더 전부(옛 양식 포함): 상품명·제조사·분류번호·상품ID, 수량·납품희망일·요청사항 순서. * 는 필수 표시 — 읽을 땐 * 와 공백을 뗀다.
	 * 헤더가 꼭 있어야 하는 칸은 REQUIRED_LABELS 뿐이고 나머지는 없으면 빈 칸으로 읽는다 (제조사는 값을 비워도 이름만으로 찾는다)
	 */
	public static final List<String> HEADER_LABELS = List.of("상품명*", "제조사", "분류번호", "상품ID", "수량*", "납품희망일*", "요청사항");

	/**
	 * 서버가 실제로 필수로 검사하는 칸(* 표시와 같다). 분류번호·상품ID 는 구매자가 알 수 없는 값이라 새 양식에서 뺐지만(계획 2026-11-24)
	 * 옛 양식은 계속 읽는다
	 */
	private static final List<String> REQUIRED_LABELS = List.of("상품명", "수량", "납품희망일");

	/**
	 * 조건 칸 헤더(계획 2026-11-09-bulk-purchase-conditions.md) — 선택. 파일에 없으면 조건 없음으로 읽으므로 조건 칸이 없던 옛 양식도 그대로 읽힌다.
	 * 순서는 CartBulkRowDto 의 minState … needCertificate
	 */
	public static final List<String> CONDITION_LABELS = List.of("최소상태", "단가상한", "최소보증(개월)", "데이터시트", "사진", "불량지원", "테스트리포트", "정품인증서");

	/** 양식(템플릿)이 내려주는 전체 열 순서: 상품 식별(구매자가 아는 이름·제조사만)·수량·희망일 → 조건 → 요청사항 */
	public static final List<String> TEMPLATE_LABELS = List.of("상품명*", "제조사", "수량*", "납품희망일*", "최소상태", "단가상한",
			"최소보증(개월)", "데이터시트", "사진", "불량지원", "테스트리포트", "정품인증서", "요청사항");

	public List<CartBulkRowDto> parse(InputStream in) {
		try (XSSFWorkbook wb = new XSSFWorkbook(in)) {
			if (wb.getNumberOfSheets() == 0) {
				throw fileError("시트가 없습니다.");
			}
			Sheet sheet = wb.getSheetAt(0);
			Row header = sheet.getRow(0);
			if (header == null) {
				throw fileError("1행(헤더)이 없습니다. 양식을 내려받아 사용해 주세요.");
			}
			int[] columns = columnIndexes(header, HEADER_LABELS, true);
			int[] conditionColumns = columnIndexes(header, CONDITION_LABELS, false);
			List<CartBulkRowDto> rows = new ArrayList<>();
			// 서식만 칠해 둔 빈 행이 많아도 내용이 있는 줄만 센다
			for (Row row : sheet) {
				if (row.getRowNum() == 0) {
					continue;
				}
				String[] v = new String[columns.length];
				String[] c = new String[conditionColumns.length];
				boolean any = false;
				for (int i = 0; i < columns.length; i++) {
					v[i] = columns[i] < 0 ? null : cellText(row.getCell(columns[i]));
					any |= v[i] != null;
				}
				for (int i = 0; i < conditionColumns.length; i++) {
					// 파일에 없는 조건 열(-1)은 조건 없음
					c[i] = conditionColumns[i] < 0 ? null : cellText(row.getCell(conditionColumns[i]));
					any |= c[i] != null;
				}
				if (!any) {
					continue;
				}
				if (rows.size() == MAX_ROWS) {
					throw fileError("한 번에 " + MAX_ROWS + "줄까지 올릴 수 있어요.");
				}
				// HEADER_LABELS 순서(상품명 제조사 분류번호 상품ID 수량 납품희망일 요청사항)와 CONDITION_LABELS 순서를 DTO 순서로. 고른 매물(sellerId·regDate)은 서버가 정한다
				rows.add(new CartBulkRowDto(row.getRowNum() + 1, v[3], v[0], v[1], v[2], v[4], v[5], v[6], null, null, c[0], c[1], c[2], c[3], c[4], c[5],
						c[6], c[7]));
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

	/** labels 각 칸이 있는 열 번호. required 면 하나라도 없을 때 양식이 아니라고 거절하고, 아니면 없는 칸은 -1 */
	private static int[] columnIndexes(Row header, List<String> labels, boolean required) {
		Map<String, Integer> byName = new HashMap<>();
		for (int c = 0; c < header.getLastCellNum(); c++) {
			String text = cellText(header.getCell(c));
			if (text != null) {
				byName.putIfAbsent(normalize(text), c);
			}
		}
		int[] columns = new int[labels.size()];
		for (int i = 0; i < columns.length; i++) {
			Integer c = byName.get(normalize(labels.get(i)));
			if (c == null && required && REQUIRED_LABELS.contains(normalize(labels.get(i)))) {
				throw fileError("헤더 \"" + labels.get(i).replace("*", "") + "\" 칸이 없습니다. 양식을 내려받아 사용해 주세요.");
			}
			columns[i] = c == null ? -1 : c;
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
