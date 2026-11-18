package com.company.market.listing.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.company.market.common.exception.ValidationException;
import com.company.market.listing.service.ListingBulkArchive.Index;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ListingBulkArchiveTest {

	private final ListingBulkArchive archive = new ListingBulkArchive();

	private static InputStreamSource zip(Charset charset, Object... nameAndContent) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (ZipOutputStream z = new ZipOutputStream(out, charset)) {
			for (int i = 0; i < nameAndContent.length; i += 2) {
				z.putNextEntry(new ZipEntry((String) nameAndContent[i]));
				z.write((byte[]) nameAndContent[i + 1]);
				z.closeEntry();
			}
		}
		return new ByteArrayResource(out.toByteArray());
	}

	private static InputStreamSource zip(Object... nameAndContent) throws IOException {
		return zip(StandardCharsets.UTF_8, nameAndContent);
	}

	private static void assertRejected(InputStreamSource source, String messagePart) {
		assertThatThrownBy(() -> archive(source))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields().get("attachments")).contains(messagePart));
	}

	private static Index archive(InputStreamSource source) {
		return new ListingBulkArchive().index(source);
	}

	@Test
	@DisplayName("정상 ZIP: 파일 이름을 소문자·공백 정리한 키로 모은다")
	void indexesNames() throws IOException {
		Index index = archive.index(zip("A100.JPG", new byte[] { 1 }, "sheet.pdf", new byte[] { 2 }));

		assertThat(index.names()).containsExactlyInAnyOrder("a100.jpg", "sheet.pdf");
	}

	@Test
	@DisplayName("읽기: 원하는 이름의 내용만 핸들러로 넘긴다")
	void readsWantedOnly() throws IOException {
		InputStreamSource source = zip("a.jpg", new byte[] { 1, 2 }, "b.jpg", new byte[] { 3 });
		Index index = archive.index(source);
		Map<String, byte[]> got = new LinkedHashMap<>();

		archive.read(source, index.charset(), Set.of("a.jpg"), got::put);

		assertThat(got).containsOnlyKeys("a.jpg");
		assertThat(got.get("a.jpg")).containsExactly(1, 2);
	}

	@Test
	@DisplayName("맥(NFD)으로 압축한 한글 이름과 윈도우(NFC)로 적은 이름이 같게 비교된다")
	void normalizesUnicodeForm() throws IOException {
		String nfd = Normalizer.normalize("사진.jpg", Normalizer.Form.NFD);
		Index index = archive.index(zip(nfd, new byte[] { 1 }));

		assertThat(index.names()).contains(ListingBulkArchive.normalize("사진.jpg"));
	}

	@Test
	@DisplayName("폴더 안 파일(경로에 /)은 거절한다 — zip-slip 포함")
	void rejectsPaths() throws IOException {
		assertRejected(zip("dir/a.jpg", new byte[] { 1 }), "폴더 없이");
		assertRejected(zip("../evil.jpg", new byte[] { 1 }), "폴더 없이");
		assertRejected(zip("..\\evil.jpg", new byte[] { 1 }), "폴더 없이");
	}

	@Test
	@DisplayName("대소문자만 다른 같은 이름이 둘이면 거절한다")
	void rejectsDuplicateNames() throws IOException {
		assertRejected(zip("a.jpg", new byte[] { 1 }, "A.JPG", new byte[] { 2 }), "같은 이름");
	}

	@Test
	@DisplayName("중첩 ZIP 은 거절한다")
	void rejectsNestedZip() throws IOException {
		assertRejected(zip("inner.zip", new byte[] { 1 }), "ZIP");
	}

	@Test
	@DisplayName("macOS 가 넣는 __MACOSX 폴더·.DS_Store 는 무시한다")
	void ignoresMacJunk() throws IOException {
		Index index = archive.index(zip("a.jpg", new byte[] { 1 }, "__MACOSX/._a.jpg", new byte[] { 2 }, ".DS_Store", new byte[] { 3 }));

		assertThat(index.names()).containsExactly("a.jpg");
	}

	@Test
	@DisplayName("해제 총량이 상한을 넘으면 거절한다 — 작은 압축본이 크게 부풀어도")
	void rejectsZipBomb() throws IOException {
		byte[] zeros = new byte[(int) ListingBulkArchive.MAX_ENTRY_BYTES];
		Object[] entries = new Object[2 * 11];
		for (int i = 0; i < 11; i++) {
			entries[2 * i] = "f" + i + ".bin";
			entries[2 * i + 1] = zeros;
		}
		InputStreamSource bomb = zip(entries);

		assertRejected(bomb, "너무 큽니다");
	}

	@Test
	@DisplayName("파일 수가 상한을 넘으면 거절한다")
	void rejectsTooManyEntries() throws IOException {
		Object[] entries = new Object[2 * (ListingBulkArchive.MAX_ENTRIES + 1)];
		for (int i = 0; i <= ListingBulkArchive.MAX_ENTRIES; i++) {
			entries[2 * i] = "f" + i + ".jpg";
			entries[2 * i + 1] = new byte[] { 1 };
		}

		assertRejected(zip(entries), "너무 많습니다");
	}

	@Test
	@DisplayName("파일 하나가 한 파일 상한을 넘으면 내용 대신 null 을 넘긴다 (줄 오류로 보이게)")
	void oversizedEntryIsNull() throws IOException {
		InputStreamSource source = zip("big.jpg", new byte[(int) ListingBulkArchive.MAX_ENTRY_BYTES + 1]);
		Index index = archive.index(source);
		Map<String, byte[]> got = new LinkedHashMap<>();

		archive.read(source, index.charset(), index.names(), got::put);

		assertThat(got).containsKey("big.jpg");
		assertThat(got.get("big.jpg")).isNull();
	}

	@Test
	@DisplayName("윈도우(MS949) 이름의 한글 파일도 읽는다")
	void readsKoreanNamesInMs949() throws IOException {
		InputStreamSource source = zip(Charset.forName("MS949"), "사진1.jpg", new byte[] { 1 });

		Index index = archive.index(source);

		assertThat(index.names()).containsExactly("사진1.jpg");
	}

	@Test
	@DisplayName("ZIP 이 아닌 내용은 거절한다")
	void rejectsNotZip() {
		assertRejected(new ByteArrayResource("not a zip".getBytes(StandardCharsets.UTF_8)), "ZIP");
	}

	@Test
	@DisplayName("빈 ZIP 은 거절한다")
	void rejectsEmptyZip() throws IOException {
		assertRejected(zip(), "비어");
	}

}
