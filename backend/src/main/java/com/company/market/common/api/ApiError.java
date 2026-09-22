package com.company.market.common.api;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 오류 응답 `{ ok: false, code, message, fields? }`. 프론트 `lib/api/client.ts` 가 이 형식을 그대로 돌려준다 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(boolean ok, String code, String message, Map<String, String> fields) {

	public static ApiError of(String code, String message) {
		return new ApiError(false, code, message, null);
	}

	public static ApiError validation(Map<String, String> fields) {
		return new ApiError(false, "VALIDATION", "입력값을 확인해 주세요.", fields);
	}

}
