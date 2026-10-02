package com.company.market.common.storage;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.util.unit.DataSize;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFileStorageTest {

	static final String KEY = "public/listings/photos/2026/10/3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b.jpg";

	@TempDir
	Path tempDir;

	LocalFileStorage storage;

	@BeforeEach
	void setUp() {
		storage = new LocalFileStorage(new StorageProperties(tempDir.toString(), DataSize.ofMegabytes(1)));
	}

	@Test
	@DisplayName("저장한 키로 다시 열면 같은 내용이다")
	void saveThenOpen() throws IOException {
		storage.save(KEY, stream("hello"));

		assertThat(tempDir.resolve(KEY)).exists();
		Resource resource = storage.open(KEY).orElseThrow();
		try (InputStream in = resource.getInputStream()) {
			assertThat(new String(in.readAllBytes(), StandardCharsets.UTF_8)).isEqualTo("hello");
		}
	}

	@Test
	@DisplayName("다 쓰고 나면 임시 파일이 남지 않는다")
	void noTempFileLeft() throws IOException {
		storage.save(KEY, stream("hello"));

		try (Stream<Path> files = Files.list(tempDir.resolve(KEY).getParent())) {
			assertThat(files.toList()).containsExactly(tempDir.resolve(KEY));
		}
	}

	@Test
	@DisplayName("형식이 어긋난 키는 저장을 거부한다")
	void rejectsMalformedKeyOnSave() throws IOException {
		assertThatThrownBy(() -> storage.save("../escape.jpg", stream("x"))).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> storage.save("public/listings/photos/../../x/2026/10/3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b.jpg",
				stream("x")))
			.isInstanceOf(IllegalArgumentException.class);

		assertThat(tempDir.getParent().resolve("escape.jpg")).doesNotExist();
		try (Stream<Path> files = Files.walk(tempDir)) {
			assertThat(files.filter(Files::isRegularFile).toList()).isEmpty();
		}
	}

	@Test
	@DisplayName("없는 키·형식이 어긋난 키를 열면 비어 있다")
	void openMissingOrMalformed() {
		assertThat(storage.open(KEY)).isEmpty();
		assertThat(storage.open("../../etc/passwd")).isEmpty();
	}

	static InputStream stream(String s) {
		return new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8));
	}

}
