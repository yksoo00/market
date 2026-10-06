package com.company.market.common.storage;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 업로드 키 선점(claim). 트랜잭션 결과에 따라 기록을 지우거나 되돌리는지 실제 Redis 로 확인한다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class UploadClaimTest {

	@Autowired
	UploadService uploads;

	@Autowired
	StringRedisTemplate redis;

	@Autowired
	TransactionTemplate tx;

	final UUID userId = UUID.randomUUID();

	@Test
	@DisplayName("커밋되면 업로드 기록과 선점 표시가 모두 지워진다")
	void commitRemovesRecord() {
		String key = recorded(UploadKind.LISTING_PHOTO);

		tx.executeWithoutResult(s -> uploads.claim(userId, List.of(photo(key))));

		assertThat(redis.hasKey(UploadService.RECORD_PREFIX + key)).isFalse();
		assertThat(redis.hasKey(UploadService.CLAIM_PREFIX + key)).isFalse();
	}

	@Test
	@DisplayName("롤백되면 업로드 기록이 되돌아와 같은 키로 다시 등록할 수 있다")
	void rollbackRestoresRecord() {
		String key = recorded(UploadKind.LISTING_PHOTO);

		tx.executeWithoutResult(s -> {
			uploads.claim(userId, List.of(photo(key)));
			s.setRollbackOnly();
		});

		assertThat(redis.opsForValue().get(UploadService.RECORD_PREFIX + key)).isEqualTo(userId + "|listing-photo");
		assertThat(redis.hasKey(UploadService.CLAIM_PREFIX + key)).isFalse();
		tx.executeWithoutResult(s -> uploads.claim(userId, List.of(photo(key))));
	}

	@Test
	@DisplayName("다른 요청이 선점 중인 키는 커밋 전이어도 거부한다 (같은 키로 동시에 두 매물 방지)")
	void rejectsKeyInUse() {
		String key = recorded(UploadKind.LISTING_PHOTO);

		tx.executeWithoutResult(s -> {
			uploads.claim(userId, List.of(photo(key)));
			assertThatThrownBy(() -> uploads.claim(userId, List.of(photo(key))))
				.isInstanceOfSatisfying(ValidationException.class,
						e -> assertThat(e.getFields()).containsEntry("photos", "파일을 다시 올려 주세요."));
		});
	}

	@Test
	@DisplayName("키 하나라도 틀리면 아무것도 선점하지 않는다 (맞는 키는 다음 요청에 그대로 쓸 수 있게)")
	void failureClaimsNothing() {
		String good = recorded(UploadKind.LISTING_PHOTO);
		String others = recorded(UploadKind.LISTING_DATASHEET, UUID.randomUUID());

		tx.executeWithoutResult(s -> assertThatThrownBy(() -> uploads.claim(userId,
				List.of(photo(good), new UploadRef("listingDataSheet", others, UploadKind.LISTING_DATASHEET))))
			.isInstanceOfSatisfying(ValidationException.class,
					e -> assertThat(e.getFields()).containsOnlyKeys("listingDataSheet")));

		assertThat(redis.hasKey(UploadService.RECORD_PREFIX + good)).isTrue();
		assertThat(redis.hasKey(UploadService.CLAIM_PREFIX + good)).isFalse();
	}

	@Test
	@DisplayName("같은 키를 두 칸에 보내도 한 번만 선점한다")
	void duplicateKeyInOneRequest() {
		String key = recorded(UploadKind.LISTING_PHOTO);

		tx.executeWithoutResult(s -> uploads.claim(userId, List.of(photo(key), photo(key))));

		assertThat(redis.hasKey(UploadService.RECORD_PREFIX + key)).isFalse();
	}

	private UploadRef photo(String key) {
		return new UploadRef("photos", key, UploadKind.LISTING_PHOTO);
	}

	private String recorded(UploadKind kind) {
		return recorded(kind, userId);
	}

	private String recorded(UploadKind kind, UUID owner) {
		String filename = kind == UploadKind.LISTING_PHOTO ? "a.jpg" : "a.pdf";
		String key = kind.newKey(FileType.fromFilename(filename).orElseThrow(), Clock.systemUTC());
		redis.opsForValue().set(UploadService.RECORD_PREFIX + key, owner + "|" + kind.value());
		return key;
	}

}
