package com.company.market.common.storage;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.ratelimit.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 2단계 업로드의 1단계: 파일을 먼저 저장하고 키를 돌려준다. 매물 등록·수정은 이 키만 받는다.
 * "누가 올렸나"는 Redis upload:<key> 에 24시간 남긴다 — 남의 파일 키나 임의 경로를 매물에 끼워 넣지 못하게
 * (스펙 docs/superpowers/specs/2026-10-02-file-upload-design.md).
 */
@Service
@RequiredArgsConstructor
public class UploadService {

	static final String RECORD_PREFIX = "upload:";

	private static final Duration RECORD_TTL = Duration.ofHours(24);

	private final FileStorage storage;

	private final StringRedisTemplate redis;

	private final RateLimiter limiter;

	private final Clock clock;

	public String upload(UUID userId, String kindValue, MultipartFile file) throws IOException {
		limiter.hit("upload:rate:" + userId, 20, Duration.ofMinutes(10));
		UploadKind kind = UploadKind.fromValue(kindValue)
			.orElseThrow(() -> new ValidationException(Map.of("kind", "알 수 없는 업로드 용도입니다.")));
		FileType type = FileType.fromFilename(file.getOriginalFilename())
			.filter(kind::allows)
			.orElseThrow(() -> new ApiException(ErrorCode.UPLOAD_INVALID_TYPE));
		if (file.isEmpty()) {
			throw new ApiException(ErrorCode.UPLOAD_INVALID_TYPE);
		}
		if (file.getSize() > kind.maxBytes()) {
			throw new ApiException(ErrorCode.UPLOAD_TOO_LARGE);
		}
		try (InputStream in = file.getInputStream()) {
			if (!type.matches(in.readNBytes(FileType.HEAD_LENGTH))) {
				throw new ApiException(ErrorCode.UPLOAD_INVALID_TYPE);
			}
		}

		String key = kind.newKey(type, clock);
		try (InputStream in = file.getInputStream()) {
			storage.save(key, in);
		}
		redis.opsForValue().set(RECORD_PREFIX + key, userId + "|" + kind.value(), RECORD_TTL);
		return key;
	}

}
