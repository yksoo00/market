package com.company.market.common.storage;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FileTypeTest {

	@Test
	@DisplayName("확장자는 대소문자를 무시하고 jpeg는 jpg로 본다")
	void extensionIsCaseInsensitive() {
		assertThat(FileType.fromFilename("PHOTO.JPG")).contains(FileType.JPG);
		assertThat(FileType.fromFilename("a.jpeg")).contains(FileType.JPG);
		assertThat(FileType.fromFilename("a.PDF")).contains(FileType.PDF);
		assertThat(FileType.JPG.extension()).isEqualTo("jpg");
	}

	@Test
	@DisplayName("확장자가 없거나 모르는 형식이면 비어 있다")
	void unknownExtensionIsEmpty() {
		assertThat(FileType.fromFilename("noext")).isEmpty();
		assertThat(FileType.fromFilename("a.exe")).isEmpty();
		assertThat(FileType.fromFilename("a.")).isEmpty();
		assertThat(FileType.fromFilename(null)).isEmpty();
	}

	@Test
	@DisplayName("매직 바이트가 형식과 맞아야 통과한다")
	void magicBytesMatch() {
		assertThat(FileType.JPG.matches(bytes(0xFF, 0xD8, 0xFF, 0xE0))).isTrue();
		assertThat(FileType.PNG.matches(bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))).isTrue();
		assertThat(FileType.WEBP.matches(ascii("RIFF\0\0\0\0WEBP"))).isTrue();
		assertThat(FileType.PDF.matches(ascii("%PDF-1.7"))).isTrue();
	}

	@Test
	@DisplayName("내용이 다른 형식이거나 비어 있으면 거부한다")
	void magicBytesMismatch() {
		assertThat(FileType.JPG.matches(ascii("%PDF-1.7"))).isFalse();
		assertThat(FileType.WEBP.matches(ascii("RIFF0000WAVE"))).isFalse();
		assertThat(FileType.PDF.matches(new byte[0])).isFalse();
		assertThat(FileType.PNG.matches(bytes(0x89, 0x50))).isFalse();
	}

	@Test
	@DisplayName("Content-Type은 형식에서 정해진다")
	void contentType() {
		assertThat(FileType.JPG.contentType()).isEqualTo("image/jpeg");
		assertThat(FileType.WEBP.contentType()).isEqualTo("image/webp");
		assertThat(FileType.PDF.contentType()).isEqualTo("application/pdf");
	}

	static byte[] bytes(int... values) {
		byte[] out = new byte[values.length];
		for (int i = 0; i < values.length; i++) {
			out[i] = (byte) values[i];
		}
		return out;
	}

	static byte[] ascii(String s) {
		return s.getBytes(StandardCharsets.ISO_8859_1);
	}

}
