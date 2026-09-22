package com.company.market.common.exception;

import java.util.Map;

/** Bean Validation 으로 표현 못 하는 필드 검증 실패(두 필드 조합 등). 응답은 400 VALIDATION + fields 로 똑같이 */
public class ValidationException extends ApiException {

	private final Map<String, String> fields;

	public ValidationException(Map<String, String> fields) {
		super(ErrorCode.VALIDATION);
		this.fields = fields;
	}

	public Map<String, String> getFields() {
		return fields;
	}

}
