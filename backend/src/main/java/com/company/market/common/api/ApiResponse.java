package com.company.market.common.api;

/** 성공 응답 `{ ok: true, data }` (rules/backend.md "API"). 오류는 {@link ApiError} */
public record ApiResponse<T>(boolean ok, T data) {

	public static <T> ApiResponse<T> of(T data) {
		return new ApiResponse<>(true, data);
	}

}
