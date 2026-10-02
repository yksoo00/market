package com.company.market.common.exception;

import com.company.market.common.api.ApiError;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class GlobalExceptionHandlerTest {

	@Test
	@DisplayName("multipart 상한 초과는 500이 아니라 413 UPLOAD_TOO_LARGE")
	void maxUploadSizeExceeded() {
		ResponseEntity<Object> res = new GlobalExceptionHandler().handleMaxUploadSizeExceededException(
				new MaxUploadSizeExceededException(10L * 1024 * 1024), new HttpHeaders(), HttpStatus.CONTENT_TOO_LARGE,
				mock(WebRequest.class));

		assertThat(res.getStatusCode().value()).isEqualTo(413);
		assertThat(res.getBody()).isInstanceOfSatisfying(ApiError.class, e -> assertThat(e.code()).isEqualTo("UPLOAD_TOO_LARGE"));
	}

}
