package com.company.market.listing.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * 다량 등록 양식. 헤더만 있고 예시 줄은 두지 않는다 — 예시를 지우지 않고 올리면 가짜 상품이 등록 후보에 올라오기 때문.
 * 상품상태 칸은 드롭다운(목록은 ListingCreateRequest.PROD_STATE_PATTERN 의 구간 값 그대로)
 */
public final class ListingBulkTemplate {

	private static final List<String> PROD_STATES = List.of("신품", "신품대비 90~99%", "신품대비 80~89%", "신품대비 70~79%",
			"신품대비 60~69%", "신품대비 50~59%", "신품대비 50% 미만");

	/** 상품상태 칸의 0부터 센 열 번호 (TEMPLATE_LABELS 의 "상품상태*") */
	private static final int PROD_STATE_COLUMN = ListingBulkParser.TEMPLATE_LABELS.indexOf("상품상태*");

	private ListingBulkTemplate() {
	}

	public static byte[] build() {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("다량 등록");
			Row header = sheet.createRow(0);
			List<String> labels = ListingBulkParser.TEMPLATE_LABELS;
			for (int c = 0; c < labels.size(); c++) {
				header.createCell(c).setCellValue(labels.get(c));
				sheet.setColumnWidth(c, 18 * 256);
			}
			DataValidationHelper helper = sheet.getDataValidationHelper();
			DataValidationConstraint list = helper.createExplicitListConstraint(PROD_STATES.toArray(String[]::new));
			DataValidation validation = helper.createValidation(list,
					new CellRangeAddressList(1, ListingBulkParser.MAX_ROWS, PROD_STATE_COLUMN, PROD_STATE_COLUMN));
			validation.setShowErrorBox(true);
			sheet.addValidationData(validation);
			wb.write(out);
			return out.toByteArray();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

}
