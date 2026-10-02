package com.company.market.common.exception;

import java.util.LinkedHashMap;
import java.util.Map;

import com.company.market.common.api.ApiError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 모든 오류를 `{ ok:false, code, message, fields? }` 로. ResponseEntityExceptionHandler 를 상속해 405·415·400(본문 깨짐)
 * 같은 MVC 표준 예외도 같은 형식이 되게 한다 — 안 그러면 catch-all 이 500 으로 삼킨다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(ValidationException.class)
	ResponseEntity<ApiError> validationException(ValidationException e) {
		return ResponseEntity.badRequest().body(ApiError.validation(e.getFields()));
	}

	@ExceptionHandler(ApiException.class)
	ResponseEntity<ApiError> apiException(ApiException e) {
		return ResponseEntity.status(e.getCode().status()).body(ApiError.of(e.getCode(), e.getMessage()));
	}

	/** Bean Validation 실패. 필드명은 요청 DTO 그대로 — 프론트가 그 이름으로 칸 옆에 표시 */
	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException e, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		Map<String, String> fields = new LinkedHashMap<>();
		e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
		return ResponseEntity.badRequest().body(ApiError.validation(fields));
	}

	@Override
	protected ResponseEntity<Object> handleNoResourceFoundException(NoResourceFoundException e, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of(ErrorCode.NOT_FOUND));
	}

	/** multipart 바깥 상한(spring.servlet.multipart) 초과. 용도별 상한 초과(UploadService)와 같은 코드로 */
	@Override
	protected ResponseEntity<Object> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException e, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		return ResponseEntity.status(ErrorCode.UPLOAD_TOO_LARGE.status()).body(ApiError.of(ErrorCode.UPLOAD_TOO_LARGE));
	}

	/** 나머지 MVC 표준 예외(405, 415, 400 …). 상태코드는 스프링이 정한 그대로, 본문만 우리 형식 */
	@Override
	protected ResponseEntity<Object> handleExceptionInternal(Exception e, Object body, HttpHeaders headers, HttpStatusCode status,
			WebRequest request) {
		if (status.value() == HttpStatus.BAD_REQUEST.value()) {
			return ResponseEntity.status(status).headers(headers).body(ApiError.of(ErrorCode.BAD_REQUEST));
		}
		HttpStatus resolved = HttpStatus.resolve(status.value());
		String code = resolved == null ? "HTTP_" + status.value() : resolved.name();
		return ResponseEntity.status(status).headers(headers).body(ApiError.ofStatus(code, "요청을 처리할 수 없습니다."));
	}

	/** 그 외 전부 500. 내부 정보(스택·메시지)는 응답에 넣지 않고 로그로만 */
	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError> unexpected(Exception e) {
		log.error("처리되지 않은 예외", e);
		return ResponseEntity.internalServerError().body(ApiError.of(ErrorCode.INTERNAL));
	}

}
