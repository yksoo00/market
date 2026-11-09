package com.company.market.trade.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

import com.company.market.listing.service.ProdStates;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * 엑셀 대량구매 양식. 헤더만 있고 예시 줄은 두지 않는다 — 지우지 않고 올리면 가짜 상품이 줄로 올라오기 때문 (판매 양식과 같은 이유).
 * 조건 칸은 드롭다운: 최소상태(상품상태 7단계), 최소보증(개월), 증빙 5칸은 Y
 */
public final class CartBulkTemplate {

	private static final List<String> MONTHS = List.of("1", "3", "6", "12", "24", "36");

	private static final List<String> EVIDENCE_COLUMNS = List.of("데이터시트", "사진", "불량지원", "테스트리포트", "정품인증서");

	private CartBulkTemplate() {
	}

	public static byte[] build() {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("대량구매");
			Row header = sheet.createRow(0);
			List<String> labels = CartBulkParser.TEMPLATE_LABELS;
			for (int c = 0; c < labels.size(); c++) {
				header.createCell(c).setCellValue(labels.get(c));
				sheet.setColumnWidth(c, 18 * 256);
			}
			dropdown(sheet, labels.indexOf("최소상태"), ProdStates.LABELS);
			dropdown(sheet, labels.indexOf("최소보증(개월)"), MONTHS);
			for (String evidence : EVIDENCE_COLUMNS) {
				dropdown(sheet, labels.indexOf(evidence), List.of("Y"));
			}
			wb.write(out);
			return out.toByteArray();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** 데이터 줄 범위(2~101행)의 한 열에 목록 선택을 건다. 목록 밖 값을 쓰면 엑셀이 막는다 */
	private static void dropdown(Sheet sheet, int column, List<String> values) {
		DataValidationHelper helper = sheet.getDataValidationHelper();
		DataValidation validation = helper.createValidation(helper.createExplicitListConstraint(values.toArray(String[]::new)),
				new CellRangeAddressList(1, CartBulkParser.MAX_ROWS, column, column));
		validation.setShowErrorBox(true);
		sheet.addValidationData(validation);
	}

}
