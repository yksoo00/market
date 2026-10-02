package com.company.market.common.storage;

import java.time.Duration;

import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 업로드 파일 열람. SecurityConfig 에서 GET 은 열어 두고 여기서 판단한다:
 * public/ 은 누구나, private/ 은 로그인 사용자만 (데이터시트 등 — 사용자 지시, decisions.md 2026-10-02).
 */
@RestController
@RequiredArgsConstructor
public class FileController {

	private final FileStorage storage;

	@GetMapping("/api/v1/files/{*path}")
	public ResponseEntity<Resource> get(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable String path) {
		String key = path.startsWith("/") ? path.substring(1) : path;
		UploadKind kind = UploadKind.ofKey(key).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
		if (!kind.isPublic() && me == null) {
			throw new ApiException(ErrorCode.UNAUTHENTICATED);
		}
		Resource file = storage.open(key).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
		// 키 형식 검사를 통과했으면 확장자는 항상 알려진 형식
		FileType type = FileType.fromFilename(key).orElseThrow();

		ResponseEntity.BodyBuilder res = ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(type.contentType()))
			.header("X-Content-Type-Options", "nosniff")
			// 공개 파일은 키가 UUID 라 같은 키의 내용이 바뀌지 않는다 → 길게 캐시. 비공개는 매번 로그인 확인
			.cacheControl(kind.isPublic() ? CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable()
					: CacheControl.noCache().cachePrivate());
		if (type == FileType.PDF) {
			res.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.inline().filename(key.substring(key.lastIndexOf('/') + 1)).build().toString());
		}
		return res.body(file);
	}

}
