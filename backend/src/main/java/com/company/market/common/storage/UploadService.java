package com.company.market.common.storage;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
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

	/** 사용자당 하루 업로드 용량 (security.md "파일 업로드"). 계정 하나가 디스크를 채우지 못하게 */
	static final long DAILY_BYTES = 300L * 1024 * 1024;

	private final FileStorage storage;

	private final StringRedisTemplate redis;

	private final RateLimiter limiter;

	private final Clock clock;

	private final StorageProperties props;

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
		// 디스크 하한을 하루 사용량보다 먼저 본다 — 서버 사정으로 거부된 업로드가 사용자 한도를 깎지 않게
		if (storage.usableSpace() - file.getSize() < props.minFree().toBytes()) {
			throw new ApiException(ErrorCode.STORAGE_FULL);
		}
		if (!limiter.tryConsume("upload:bytes:" + userId, file.getSize(), DAILY_BYTES, Duration.ofDays(1))) {
			throw new ApiException(ErrorCode.UPLOAD_QUOTA_EXCEEDED);
		}

		String key = kind.newKey(type, clock);
		try (InputStream in = file.getInputStream()) {
			storage.save(key, in);
		}
		redis.opsForValue().set(RECORD_PREFIX + key, userId + "|" + kind.value(), RECORD_TTL);
		return key;
	}

	/**
	 * 각 키가 "이 사용자가 24시간 안에 이 용도로 올린 파일"인지 확인. 실패한 필드를 모두 모아 400 VALIDATION.
	 * 기록은 지우지 않는다 — 호출자가 DB 저장에 성공한 뒤 release 로 지운다 (저장 실패 시 재시도 가능하게).
	 */
	public void verifyOwned(UUID userId, List<UploadRef> refs) {
		Map<String, Boolean> checked = new HashMap<>();
		Map<String, String> failures = new LinkedHashMap<>();
		for (UploadRef ref : refs) {
			String expected = userId + "|" + ref.kind().value();
			boolean ok = UploadKind.ofKey(ref.key()).filter(ref.kind()::equals).isPresent()
					&& checked.computeIfAbsent(ref.key() + "|" + ref.kind().value(),
							k -> expected.equals(redis.opsForValue().get(RECORD_PREFIX + ref.key())));
			if (!ok) {
				failures.putIfAbsent(ref.field(), "파일을 다시 올려 주세요.");
			}
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
	}

	/** 매물에 저장된 키의 업로드 기록을 지운다 — 같은 업로드를 다른 매물에 다시 쓰지 못하게 */
	public void release(Collection<String> keys) {
		if (!keys.isEmpty()) {
			redis.delete(keys.stream().map(k -> RECORD_PREFIX + k).toList());
		}
	}

}
