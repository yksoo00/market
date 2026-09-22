package com.company.market.common.exception;

/** 도메인에서 던지는 예외. 전역 핸들러가 `{ ok:false, code, message }` 로 바꾼다. 코드·상태·기본 문구는 {@link ErrorCode} */
public class ApiException extends RuntimeException {

	private final ErrorCode code;

	public ApiException(ErrorCode code) {
		this(code, code.message());
	}

	/** 기본 문구 대신 상황에 맞는 문구가 필요할 때. 코드는 그대로라 프론트 매핑은 안 깨진다 */
	public ApiException(ErrorCode code, String message) {
		super(message);
		this.code = code;
	}

	public ErrorCode getCode() {
		return code;
	}

}
