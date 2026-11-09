package com.company.market.trade.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** 엑셀 대량구매 양식. 헤더만 있고 예시 줄은 두지 않는다 — 지우지 않고 올리면 가짜 상품이 줄로 올라오기 때문 (판매 양식과 같은 이유) */
public final class CartBulkTemplate {

	private CartBulkTemplate() {
	}

	public static byte[] build() {
		try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Sheet sheet = wb.createSheet("대량구매");
			Row header = sheet.createRow(0);
			List<String> labels = CartBulkParser.HEADER_LABELS;
			for (int c = 0; c < labels.size(); c++) {
				header.createCell(c).setCellValue(labels.get(c));
				sheet.setColumnWidth(c, 18 * 256);
			}
			wb.write(out);
			return out.toByteArray();
		}
		catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

}
