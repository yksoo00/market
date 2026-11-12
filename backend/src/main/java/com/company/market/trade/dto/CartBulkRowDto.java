package com.company.market.trade.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 엑셀 대량구매의 한 줄 (계획 2026-11-09-bulk-purchase-excel.md, 조건 칸은 2026-11-09-bulk-purchase-conditions.md). 엑셀 칸이 숫자 아닌
 * 글자여도 줄 오류로 보이게(400 으로 전체가 막히지 않게) 수량·단가 상한 같은 숫자도 글자로 받는다. rowNo 는 엑셀 행 번호(1행이 헤더라 데이터는 2부터).
 * sellerId·regDate 는 사용자가 고른 매물 — 비어 있으면 서버가 기본(조건을 통과한 매물 중 정렬 기준 1순위)을 정한다. 이 값은 사용자 입력일 뿐이라 서버가 후보와 대조해 검증한다.
 * 조건 칸(minState~needCertificate)은 모두 선택 — 비우면 조건 없음. need* 는 "Y" 만 의미가 있다(그 증빙이 매물에 있어야 함)
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
		@Size(max = MAX_TEXT) String regDate,
		@Size(max = MAX_TEXT) String minState,
		@Size(max = MAX_TEXT) String maxPrice,
		@Size(max = MAX_TEXT) String minWarrantyMonths,
		@Size(max = MAX_TEXT) String needDataSheet,
		@Size(max = MAX_TEXT) String needPhoto,
		@Size(max = MAX_TEXT) String needCoverage,
		@Size(max = MAX_TEXT) String needTestReport,
		@Size(max = MAX_TEXT) String needCertificate) {

	/** 칸마다 정확한 검사는 서비스가 한다. 여기는 그 전에 정규식·검증이 거대한 글자를 도는 일을 막는 바깥 한도 */
	public static final int MAX_TEXT = 300;

}
