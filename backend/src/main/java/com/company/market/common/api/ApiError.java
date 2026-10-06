package com.company.market.common.api;

import java.util.Map;

import com.company.market.common.exception.ErrorCode;
import com.fasterxml.jackson.annotation.JsonInclude;

/** 오류 응답 `{ ok: false, code, message, fields? }`. 프론트 `lib/api/client.ts` 가 이 형식을 그대로 돌려준다 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(boolean ok, String code, String message, Map<String, String> fields) {

	public static ApiError of(ErrorCode code) {
		return new ApiError(false, code.name(), code.message(), null);
	}

	public static ApiError of(ErrorCode code, String message) {
		return new ApiError(false, code.name(), message, null);
	}

	public static ApiError of(ErrorCode code, String message, Map<String, String> fields) {
		return new ApiError(false, code.name(), message, fields);
	}

	/** ErrorCode 에 없는 상태(MVC 표준 예외의 405·415 등)용. 코드는 HTTP 상태 이름 */
	public static ApiError ofStatus(String httpStatusName, String message) {
		return new ApiError(false, httpStatusName, message, null);
	}

	public static ApiError validation(Map<String, String> fields) {
		return new ApiError(false, ErrorCode.VALIDATION.name(), ErrorCode.VALIDATION.message(), fields);
	}

}
