package com.company.market.listing.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 엑셀 다량 등록의 한 줄. 엑셀 칸이 숫자 아닌 글자여도 줄 오류로 보이게(400 으로 전체가 막히지 않게) 숫자 칸도 문자열로 받는다.
 * rowNo 는 엑셀 행 번호(1행이 헤더라 데이터는 2부터). 필드 이름은 BulkRowResult.fields 의 키와 같다.
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
		@Size(max = MAX_TEXT) String description) {

	/**
	 * 칸마다 정확한 길이 검사는 ListingCreateRequest 가 한다. 여기는 그 검사 전에 정규식·검증이 거대한 글자를 도는 일을 막는 바깥 한도
	 * (가장 긴 칸 설명 200자의 여유)
	 */
	public static final int MAX_TEXT = 300;

}
