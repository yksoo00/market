package com.company.market.common.storage;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
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
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.Assert;
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

	/** 매물 저장 트랜잭션이 끝날 때까지 기록을 옮겨 두는 곳 (claim) */
	static final String CLAIM_PREFIX = "upload-claim:";

	private static final String REUPLOAD = "파일을 다시 올려 주세요.";

	/**
	 * KEYS = 기록 n개 + 선점 n개, ARGV = 기대값 n개. 다 맞으면 전부 RENAME 하고 빈 목록, 하나라도 틀리면 틀린 위치(1부터)만
	 * 돌려주고 아무것도 옮기지 않는다
	 */
	private static final RedisScript<List> CLAIM = new DefaultRedisScript<>("""
			local n = #ARGV
			local failed = {}
			for i = 1, n do
				if redis.call('GET', KEYS[i]) ~= ARGV[i] then table.insert(failed, i) end
			end
			if #failed > 0 then return failed end
			for i = 1, n do redis.call('RENAME', KEYS[i], KEYS[n + i]) end
			return failed
			""", List.class);

	/** 롤백: 남아 있는 선점을 기록으로 되돌린다 (TTL 이 지나 사라진 것은 건너뜀) */
	private static final RedisScript<Long> UNCLAIM = new DefaultRedisScript<>("""
			local n = #KEYS / 2
			for i = 1, n do
				if redis.call('EXISTS', KEYS[n + i]) == 1 then redis.call('RENAME', KEYS[n + i], KEYS[i]) end
			end
			return n
			""", Long.class);

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
	 * 각 키가 "이 사용자가 24시간 안에 이 용도로 올린 파일"인지 확인하고, 맞으면 한 번에 선점한다.
	 * 실패한 필드를 모두 모아 400 VALIDATION. 하나라도 틀리면 아무것도 선점하지 않는다.
	 * 선점 = 기록을 upload-claim:<key> 로 RENAME (TTL 유지). 확인과 선점이 Lua 하나라 같은 키로 동시에 두 요청이
	 * 와도 하나만 통과한다. 기록은 커밋된 뒤에 지우고, 롤백되면 되돌린다 — 저장이 실패해도 다시 올리지 않게.
	 * 호출자의 트랜잭션 안에서만 부른다.
	 */
	public void claim(UUID userId, List<UploadRef> refs) {
		Map<String, String> failures = new LinkedHashMap<>();
		// 키 → 그 키를 쓴 필드들. 같은 키를 두 칸에 보내도 한 번만 선점한다 (용도는 키 형식이 정하므로 키마다 하나)
		Map<String, List<String>> fieldsByKey = new LinkedHashMap<>();
		Map<String, String> expectedByKey = new HashMap<>();
		for (UploadRef ref : refs) {
			if (UploadKind.ofKey(ref.key()).filter(ref.kind()::equals).isEmpty()) {
				failures.putIfAbsent(ref.field(), REUPLOAD);
				continue;
			}
			fieldsByKey.computeIfAbsent(ref.key(), k -> new ArrayList<>()).add(ref.field());
			expectedByKey.put(ref.key(), userId + "|" + ref.kind().value());
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
		if (fieldsByKey.isEmpty()) {
			return;
		}
		Assert.state(TransactionSynchronizationManager.isSynchronizationActive(), "업로드 선점은 트랜잭션 안에서만");

		List<String> keys = List.copyOf(fieldsByKey.keySet());
		List<String> redisKeys = new ArrayList<>();
		keys.forEach(k -> redisKeys.add(RECORD_PREFIX + k));
		keys.forEach(k -> redisKeys.add(CLAIM_PREFIX + k));
		List<?> failed = redis.execute(CLAIM, redisKeys, keys.stream().map(expectedByKey::get).toArray());
		if (failed != null && !failed.isEmpty()) {
			failed.forEach(i -> fieldsByKey.get(keys.get(((Number) i).intValue() - 1))
				.forEach(f -> failures.putIfAbsent(f, REUPLOAD)));
			throw new ValidationException(failures);
		}

		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCompletion(int status) {
				if (status == STATUS_COMMITTED) {
					redis.delete(keys.stream().map(k -> CLAIM_PREFIX + k).toList());
				}
				else {
					redis.execute(UNCLAIM, redisKeys);
				}
			}
		});
	}

}
