package com.company.market.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 도메인에서 던지는 예외. 전역 핸들러가 `{ ok:false, code, message }` 로 바꾼다.
 * code 는 프론트 `messages/*.ts` 의 errors 키와 같아야 한다 (프론트가 코드로 문구를 고름).
 */
public class ApiException extends RuntimeException {

	private final HttpStatus status;

	private final String code;

	public ApiException(HttpStatus status, String code, String message) {
		super(message);
		this.status = status;
		this.code = code;
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getCode() {
		return code;
	}

}
