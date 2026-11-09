package com.company.market.trade.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 엑셀 대량구매의 한 줄 (계획 2026-11-09-bulk-purchase-excel.md). 엑셀 칸이 숫자 아닌 글자여도 줄 오류로 보이게(400 으로 전체가 막히지 않게)
 * 수량도 글자로 받는다. rowNo 는 엑셀 행 번호(1행이 헤더라 데이터는 2부터). sellerId·regDate 는 사용자가 고른 매물 —
 * 비어 있으면 서버가 기본(재고가 충분한 최저가)을 정한다. 이 값은 사용자 입력일 뿐이라 서버가 후보와 대조해 검증한다.
 */
public record CartBulkRowDto(
		@Positive int rowNo,
		@Size(max = MAX_TEXT) String prodId,
		@Size(max = MAX_TEXT) String prodName,
		@Size(max = MAX_TEXT) String prodBrand,
		@Size(max = MAX_TEXT) String prodClassNo,
		@Size(max = MAX_TEXT) String orderQuantity,
		@Size(max = MAX_TEXT) String reqDeliDate,
		@Size(max = MAX_TEXT) String remarks,
		@Size(max = MAX_TEXT) String sellerId,
		@Size(max = MAX_TEXT) String regDate) {

	/** 칸마다 정확한 검사는 서비스가 한다. 여기는 그 전에 정규식·검증이 거대한 글자를 도는 일을 막는 바깥 한도 */
	public static final int MAX_TEXT = 300;

}
