package com.company.market.common.exception;

import org.springframework.http.HttpStatus;

/**
 * API 오류 코드 전부. 기능별(Login/Signup)로 쪼개지 않고 "무슨 문제인가" 기준 하나의 목록 — 같은 문제(VALIDATION,
 * UNAUTHENTICATED …)가 여러 기능에서 나오기 때문. 이름은 프론트 `messages/*.ts` 의 errors 키와 1:1 이라 이 파일이
 * 프론트와의 계약이다. 새 코드를 넣으면 프론트 문구도 같은 PR 에서.
 */
public enum ErrorCode {

	// 공통
	VALIDATION(HttpStatus.BAD_REQUEST, "입력값을 확인해 주세요."),
	BAD_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식이 올바르지 않습니다."),
	UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
	FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
	NOT_FOUND(HttpStatus.NOT_FOUND, "없는 경로입니다."),
	RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "시도가 너무 많습니다. 잠시 후 다시 시도하세요."),
	INTERNAL(HttpStatus.INTERNAL_SERVER_ERROR, "일시적인 오류가 발생했습니다."),
	REQUEST_IN_PROGRESS(HttpStatus.CONFLICT, "같은 요청을 처리하고 있습니다. 잠시 후 다시 시도해 주세요."),

	// 인증
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 맞지 않습니다."),
	LOCKED(HttpStatus.TOO_MANY_REQUESTS, "로그인을 5회 이상 실패해 15분간 잠겼습니다."),
	ACCOUNT_SUSPENDED(HttpStatus.FORBIDDEN, "이용이 정지된 계정입니다. 고객센터로 문의해 주세요."),
	SESSION_EXPIRED(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요."),

	// 가입
	DUPLICATE_LOGIN_ID(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다."),
	DUPLICATE_NICKNAME(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
	DUPLICATE_EMAIL(HttpStatus.CONFLICT, "이미 가입된 이메일입니다."),
	DUPLICATE_PHONE(HttpStatus.CONFLICT, "이미 가입된 휴대폰 번호입니다."),
	DUPLICATE_BIZ_NO(HttpStatus.CONFLICT, "이미 가입된 사업자등록번호입니다."),
	ALREADY_REGISTERED(HttpStatus.CONFLICT, "이미 가입된 회원입니다. 아이디 찾기를 이용해 주세요."),
	VERIFICATION_EXPIRED(HttpStatus.GONE, "본인인증이 만료되었습니다. 처음부터 다시 진행해 주세요."),
	BUSINESS_VERIFICATION_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "사업자 인증 연동이 아직 준비되지 않았습니다."),

	// 소셜 로그인. OAUTH_FAILED·OAUTH_EMAIL_REQUIRED·EMAIL_ALREADY_REGISTERED 는 콜백 리다이렉트 ?error= 로도 나간다
	OAUTH_EXPIRED(HttpStatus.GONE, "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."),
	OAUTH_FAILED(HttpStatus.BAD_REQUEST, "소셜 로그인에 실패했습니다. 다시 시도해 주세요."),
	OAUTH_EMAIL_REQUIRED(HttpStatus.BAD_REQUEST, "이메일 제공에 동의해야 가입할 수 있습니다."),
	EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT, "이미 다른 방식으로 가입된 이메일입니다."),

	// 매물
	LISTING_DUPLICATE_REG_TIME(HttpStatus.CONFLICT, "같은 시각에 이미 등록된 매물이 있습니다. 다시 시도해 주세요."),
	LISTING_NOT_FOUND(HttpStatus.NOT_FOUND, "매물을 찾을 수 없습니다."),
	PRODUCT_SHARED(HttpStatus.UNPROCESSABLE_ENTITY, "다른 판매자와 같이 쓰는 상품 정보라 고칠 수 없습니다."),

	// 업로드
	UPLOAD_INVALID_TYPE(HttpStatus.BAD_REQUEST, "올릴 수 없는 파일 형식입니다."),
	UPLOAD_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "파일이 너무 큽니다."),
	UPLOAD_QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "오늘 올릴 수 있는 파일 용량(300MB)을 넘었습니다."),
	STORAGE_FULL(HttpStatus.SERVICE_UNAVAILABLE, "지금은 파일을 올릴 수 없습니다. 잠시 후 다시 시도해 주세요.");

	private final HttpStatus status;

	private final String message;

	ErrorCode(HttpStatus status, String message) {
		this.status = status;
		this.message = message;
	}

	public HttpStatus status() {
		return status;
	}

	public String message() {
		return message;
	}

}
