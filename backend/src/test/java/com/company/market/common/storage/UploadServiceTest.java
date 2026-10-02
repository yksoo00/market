package com.company.market.common.storage;

import java.io.IOException;
import java.time.Clock;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.ratelimit.RateLimiter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UploadServiceTest {

	@Mock
	FileStorage storage;

	@Mock
	StringRedisTemplate redis;

	@Mock
	RateLimiter limiter;

	@Test
	@DisplayName("디스크 여유 공간이 하한보다 적으면 503 STORAGE_FULL이고 저장·사용량 차감을 하지 않는다")
	void rejectsWhenDiskAlmostFull() throws IOException {
		UploadService service = new UploadService(storage, redis, limiter, Clock.systemUTC(),
				new StorageProperties("unused", DataSize.ofGigabytes(10)));
		when(storage.usableSpace()).thenReturn(DataSize.ofGigabytes(10).toBytes() - 1);

		assertThatThrownBy(() -> service.upload(UUID.randomUUID(), "listing-photo",
				new MockMultipartFile("file", "a.jpg", "image/jpeg", UploadApiTest.JPG)))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode())
				.isEqualTo(ErrorCode.STORAGE_FULL));
		verify(storage, never()).save(any(), any());
		verify(limiter, never()).tryConsume(any(), anyLong(), anyLong(),
				any());
	}

}
