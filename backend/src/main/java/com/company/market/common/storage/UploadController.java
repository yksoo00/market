package com.company.market.common.storage;

import java.io.IOException;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** 로그인 필수 — SecurityConfig 의 anyRequest().authenticated() 가 막는다 */
@RestController
@RequiredArgsConstructor
public class UploadController {

	private final UploadService uploads;

	@PostMapping(value = "/api/v1/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<ApiResponse<UploadResponse>> upload(@AuthenticationPrincipal AuthenticatedUser me,
			@RequestParam String kind, @RequestPart MultipartFile file) throws IOException {
		String key = uploads.upload(me.id(), kind, file);
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(new UploadResponse(key)));
	}

}
