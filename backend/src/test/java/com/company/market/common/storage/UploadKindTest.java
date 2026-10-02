package com.company.market.common.storage;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UploadKindTest {

	static final String UUID = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

	@Test
	@DisplayName("용도 값으로 찾고, 모르는 값은 비어 있다")
	void fromValue() {
		assertThat(UploadKind.fromValue("listing-photo")).contains(UploadKind.LISTING_PHOTO);
		assertThat(UploadKind.fromValue("listing-replace-prod")).contains(UploadKind.LISTING_REPLACE_PROD);
		assertThat(UploadKind.fromValue("photo")).isEmpty();
		assertThat(UploadKind.fromValue(null)).isEmpty();
	}

	@Test
	@DisplayName("사진은 공개·5MB·이미지만, 데이터시트는 비공개·10MB·PDF만")
	void rulesPerKind() {
		assertThat(UploadKind.LISTING_PHOTO.isPublic()).isTrue();
		assertThat(UploadKind.LISTING_PHOTO.maxBytes()).isEqualTo(5L * 1024 * 1024);
		assertThat(UploadKind.LISTING_PHOTO.allows(FileType.WEBP)).isTrue();
		assertThat(UploadKind.LISTING_PHOTO.allows(FileType.PDF)).isFalse();

		assertThat(UploadKind.LISTING_DATASHEET.isPublic()).isFalse();
		assertThat(UploadKind.LISTING_DATASHEET.maxBytes()).isEqualTo(10L * 1024 * 1024);
		assertThat(UploadKind.LISTING_DATASHEET.allows(FileType.PDF)).isTrue();
		assertThat(UploadKind.LISTING_DATASHEET.allows(FileType.JPG)).isFalse();

		assertThat(UploadKind.LISTING_TEST_REPORT.allows(FileType.PNG)).isTrue();
		assertThat(UploadKind.LISTING_TEST_REPORT.allows(FileType.WEBP)).isFalse();
		assertThat(UploadKind.LISTING_CERTIFICATE.isPublic()).isFalse();
		assertThat(UploadKind.LISTING_REPLACE_PROD.allows(FileType.PDF)).isTrue();
	}

	@Test
	@DisplayName("새 키는 폴더/연/월/uuid.확장자 이고 ofKey로 같은 용도가 나온다")
	void newKeyRoundTrip() {
		Clock clock = Clock.fixed(Instant.parse("2026-10-02T00:00:00Z"), ZoneOffset.UTC);

		String key = UploadKind.LISTING_REPLACE_PROD.newKey(FileType.PDF, clock);

		assertThat(key).startsWith("private/listings/replace-prods/2026/10/").endsWith(".pdf").hasSizeLessThanOrEqualTo(100);
		assertThat(UploadKind.ofKey(key)).contains(UploadKind.LISTING_REPLACE_PROD);
		assertThat(UploadKind.ofKey(UploadKind.LISTING_PHOTO.newKey(FileType.JPG, clock))).contains(UploadKind.LISTING_PHOTO);
	}

	@Test
	@DisplayName("형식이 어긋난 키는 용도를 찾지 못한다")
	void malformedKeys() {
		assertThat(UploadKind.ofKey("/public/listings/photos/2026/10/" + UUID + ".jpg")).isEmpty();
		assertThat(UploadKind.ofKey("public/listings/photos/../../private/listings/datasheets/2026/10/" + UUID + ".pdf")).isEmpty();
		assertThat(UploadKind.ofKey("public/listings/photos/2026/10/a.jpg")).isEmpty();
		assertThat(UploadKind.ofKey("public/listings/photos/2026/10/" + UUID + ".JPG")).isEmpty();
		assertThat(UploadKind.ofKey("public/listings/other/2026/10/" + UUID + ".jpg")).isEmpty();
		assertThat(UploadKind.ofKey("p1.jpg")).isEmpty();
		assertThat(UploadKind.ofKey(null)).isEmpty();
	}

}
