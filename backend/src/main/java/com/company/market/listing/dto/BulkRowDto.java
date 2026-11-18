package com.company.market.listing.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 엑셀 다량 등록의 한 줄. 엑셀 칸이 숫자 아닌 글자여도 줄 오류로 보이게(400 으로 전체가 막히지 않게) 숫자 칸도 문자열로 받는다.
 * rowNo 는 엑셀 행 번호(1행이 헤더라 데이터는 2부터). 필드 이름은 BulkRowResult.fields 의 키와 같다.
 * photo1~4·dataSheet 는 ZIP 으로 올린 첨부 (계획 2026-11-18-bulk-listing-zip.md) — 없으면 null.
 */
public record BulkRowDto(
		@Positive int rowNo,
		@Size(max = MAX_TEXT) String prodId,
		@Size(max = MAX_TEXT) String prodName,
		@Size(max = MAX_TEXT) String prodBrand,
		@Size(max = MAX_TEXT) String prodClassNo,
		@Size(max = MAX_TEXT) String prodNo,
		@Size(max = MAX_TEXT) String categoryCode,
		@Size(max = MAX_TEXT) String prodState,
		@Size(max = MAX_TEXT) String salesUnitPrice,
		@Size(max = MAX_TEXT) String salesQuantity,
		@Size(max = MAX_TEXT) String minOrderQuantity,
		@Size(max = MAX_TEXT) String orderUnit,
		@Size(max = MAX_TEXT) String deliveryDate,
		@Size(max = MAX_TEXT) String description,
		@Valid BulkFile photo1,
		@Valid BulkFile photo2,
		@Valid BulkFile photo3,
		@Valid BulkFile photo4,
		@Valid BulkFile dataSheet) {

	/**
	 * 칸마다 정확한 길이 검사는 ListingCreateRequest 가 한다. 여기는 그 검사 전에 정규식·검증이 거대한 글자를 도는 일을 막는 바깥 한도
	 * (가장 긴 칸 설명 200자의 여유)
	 */
	public static final int MAX_TEXT = 300;

	/** 첨부 없는 줄 (ZIP 없이 엑셀만 올린 경우·테스트) */
	public BulkRowDto(int rowNo, String prodId, String prodName, String prodBrand, String prodClassNo, String prodNo, String categoryCode,
			String prodState, String salesUnitPrice, String salesQuantity, String minOrderQuantity, String orderUnit, String deliveryDate,
			String description) {
		this(rowNo, prodId, prodName, prodBrand, prodClassNo, prodNo, categoryCode, prodState, salesUnitPrice, salesQuantity,
				minOrderQuantity, orderUnit, deliveryDate, description, null, null, null, null, null);
	}

	/** 첨부 칸 이름 — BulkRowResult.fields 의 키와 같다. 순서는 사진1~4, 데이터시트 */
	public static final String[] FILE_FIELDS = { "photo1", "photo2", "photo3", "photo4", "dataSheet" };

	/** FILE_FIELDS 순서의 5칸 */
	public BulkFile[] files() {
		return new BulkFile[] { photo1, photo2, photo3, photo4, dataSheet };
	}

	/** files() 와 같은 순서의 5칸으로 첨부만 바꾼 새 줄 */
	public BulkRowDto withFiles(BulkFile[] f) {
		return new BulkRowDto(rowNo, prodId, prodName, prodBrand, prodClassNo, prodNo, categoryCode, prodState, salesUnitPrice,
				salesQuantity, minOrderQuantity, orderUnit, deliveryDate, description, f[0], f[1], f[2], f[3], f[4]);
	}

}
