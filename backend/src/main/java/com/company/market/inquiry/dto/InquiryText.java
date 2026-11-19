package com.company.market.inquiry.dto;

/** 문의 입력 검증 정규식 (요청 DTO 둘이 같이 쓴다) */
final class InquiryText {

	/** 보이는 글자가 하나라도 있다. 공백·전각 공백·NBSP·BOM 만 있는 값은 거절 */
	static final String VISIBLE = "(?s).*[^\\s\\u00A0\\uFEFF\\u3000].*";

	/** NUL 문자 없음 */
	static final String NO_NUL = "[^\\u0000]*";

	static final String NUL_MESSAGE = "사용할 수 없는 문자가 들어 있어요";

	private InquiryText() {
	}

}
