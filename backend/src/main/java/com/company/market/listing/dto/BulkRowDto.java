package com.company.market.listing.dto;

/**
 * 엑셀 다량 등록의 한 줄. 엑셀 칸이 숫자 아닌 글자여도 줄 오류로 보이게(400 으로 전체가 막히지 않게) 숫자 칸도 문자열로 받는다.
 * rowNo 는 엑셀 행 번호(1행이 헤더라 데이터는 2부터). 필드 이름은 BulkRowResult.fields 의 키와 같다.
 */
public record BulkRowDto(
		int rowNo,
		String prodId,
		String prodName,
		String prodBrand,
		String prodClassNo,
		String prodNo,
		String categoryCode,
		String prodState,
		String salesUnitPrice,
		String salesQuantity,
		String minOrderQuantity,
		String orderUnit,
		String deliveryDate,
		String description) {
}
