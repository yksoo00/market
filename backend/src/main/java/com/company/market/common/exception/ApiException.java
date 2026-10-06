package com.company.market.common.exception;

import java.util.Map;

/** 도메인에서 던지는 예외. 전역 핸들러가 `{ ok:false, code, message }` 로 바꾼다. 코드·상태·기본 문구는 {@link ErrorCode} */
public class ApiException extends RuntimeException {

	private final ErrorCode code;

	/** 칸별 문구(검증 응답과 같은 형태). 없으면 null */
	private final Map<String, String> fields;

	public ApiException(ErrorCode code) {
		this(code, code.message());
	}

	/** 기본 문구 대신 상황에 맞는 문구가 필요할 때. 코드는 그대로라 프론트 매핑은 안 깨진다 */
	public ApiException(ErrorCode code, String message) {
		this(code, message, null);
	}

	/** 상태가 맞지 않아 거절하되(422 등) 어느 칸 때문인지 알려야 할 때 — 프론트가 fields 의 칸 옆에 표시 */
	public ApiException(ErrorCode code, String message, Map<String, String> fields) {
		super(message);
		this.code = code;
		this.fields = fields;
	}

	public ErrorCode getCode() {
		return code;
	}

	public Map<String, String> getFields() {
		return fields;
	}

}
