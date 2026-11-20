package com.company.market.common.storage;

import com.company.market.TestUids;
import java.io.IOException;
import java.time.Clock;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
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

	@Test
	@DisplayName("디스크 여유 공간이 하한보다 적으면 503 STORAGE_FULL이고 저장하지 않는다")
	void rejectsWhenDiskAlmostFull() throws IOException {
		UploadService service = new UploadService(storage, redis, Clock.systemUTC(),
				new StorageProperties("unused", DataSize.ofGigabytes(10)));
		when(storage.usableSpace()).thenReturn(DataSize.ofGigabytes(10).toBytes() - 1);

		assertThatThrownBy(() -> service.upload(TestUids.random(), "listing-photo",
				new MockMultipartFile("file", "a.jpg", "image/jpeg", UploadApiTest.JPG)))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode())
				.isEqualTo(ErrorCode.STORAGE_FULL));
		verify(storage, never()).save(any(), any());
	}

	@Test
	@DisplayName("store: 사진 용도에 pdf 확장자면 UPLOAD_INVALID_TYPE 이고 저장하지 않는다")
	void storeRejectsWrongType() throws IOException {
		UploadService service = new UploadService(storage, redis, Clock.systemUTC(),
				new StorageProperties("unused", DataSize.ofGigabytes(10)));

		assertThatThrownBy(() -> service.store(TestUids.random(), UploadKind.LISTING_PHOTO, "a.pdf", UploadApiTest.JPG))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(ErrorCode.UPLOAD_INVALID_TYPE));
		verify(storage, never()).save(any(), any());
	}

	@Test
	@DisplayName("store: 확장자는 jpg 인데 내용이 jpg 가 아니면 UPLOAD_INVALID_TYPE")
	void storeRejectsBadMagic() throws IOException {
		UploadService service = new UploadService(storage, redis, Clock.systemUTC(),
				new StorageProperties("unused", DataSize.ofGigabytes(10)));

		assertThatThrownBy(() -> service.store(TestUids.random(), UploadKind.LISTING_PHOTO, "a.jpg", new byte[] { 1, 2, 3, 4 }))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(ErrorCode.UPLOAD_INVALID_TYPE));
	}

	@Test
	@DisplayName("store: 용도별 크기 상한(사진 5MB)을 넘으면 UPLOAD_TOO_LARGE")
	void storeRejectsTooLarge() {
		UploadService service = new UploadService(storage, redis, Clock.systemUTC(),
				new StorageProperties("unused", DataSize.ofGigabytes(10)));
		byte[] big = new byte[(int) UploadKind.LISTING_PHOTO.maxBytes() + 1];
		System.arraycopy(UploadApiTest.JPG, 0, big, 0, UploadApiTest.JPG.length);

		assertThatThrownBy(() -> service.store(TestUids.random(), UploadKind.LISTING_PHOTO, "a.jpg", big))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(ErrorCode.UPLOAD_TOO_LARGE));
	}

}
