package com.company.market.listing.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipInputStream;

import com.company.market.common.exception.ValidationException;
import org.springframework.core.io.InputStreamSource;
import org.springframework.stereotype.Component;

/**
 * 다량 등록 ZIP(사진·데이터시트)을 안전하게 읽는다 (계획 2026-11-18-bulk-listing-zip.md).
 * 파일 이름은 저장 경로에 쓰지 않고 엑셀 칸과 이름을 맞춰 보는 데만 쓴다 — 그래도 경로가 든 이름·중첩 ZIP 은 거절한다.
 * 압축 헤더의 크기는 믿지 않고 읽으면서 센다 (zip bomb 방지).
 * 두 단계로 읽는다: index 가 구조·총량을 전부 검증하고, read 는 필요한 파일만 한 개씩 메모리에 올려 넘긴다 —
 * 검증이 끝난 뒤에만 저장을 시작해 거절된 ZIP 이 파일을 남기지 않게.
 */
@Component
public class ListingBulkArchive {

	/** 줄 200 × (사진 4 + 데이터시트 1) 에 여유를 둔 파일 수 한도 */
	public static final int MAX_ENTRIES = 1_000;

	/** 풀었을 때 총량 (보내는 용량 50MB 의 2배) */
	public static final long MAX_TOTAL_BYTES = 100L * 1024 * 1024;

	/** 파일 하나를 메모리에 올리는 한도 = 가장 큰 용도(데이터시트 pdf 10MB). 넘으면 내용 대신 null 을 넘겨 줄 오류로 보이게 한다 */
	public static final long MAX_ENTRY_BYTES = 10L * 1024 * 1024;

	private static final String FIELD = "attachments";

	/** 윈도우 탐색기·옛 압축 도구는 한글 이름을 이 코드페이지로 넣는다 (UTF-8 플래그가 없을 때) */
	private static final Charset LEGACY_KOREAN = Charset.forName("MS949");

	/** 파일 이름(소문자·앞뒤 공백 제거)을 모은 결과 + 이름이 읽힌 문자셋 */
	public record Index(Charset charset, Set<String> names) {
	}

	/** content 가 null 이면 MAX_ENTRY_BYTES 를 넘는 파일 */
	@FunctionalInterface
	public interface Handler {

		void accept(String name, byte[] content) throws IOException;

	}

	/** 엑셀 칸 이름과 ZIP 안 이름을 같은 방식으로 비교하기 위한 정리 */
	public static String normalize(String name) {
		return name.trim().toLowerCase(Locale.ROOT);
	}

	public Index index(InputStreamSource zip) {
		try {
			return scan(zip, StandardCharsets.UTF_8);
		}
		catch (IllegalArgumentException e) {
			// 이름이 UTF-8 이 아님 → 윈도우 한글 코드페이지로 한 번 더
			try {
				return scan(zip, LEGACY_KOREAN);
			}
			catch (IllegalArgumentException | IOException second) {
				throw error("ZIP 파일 이름을 읽을 수 없습니다. 파일 이름을 바꿔 다시 압축해 주세요.");
			}
		}
		catch (IOException e) {
			throw error("ZIP 파일을 읽을 수 없습니다.");
		}
	}

	private Index scan(InputStreamSource zip, Charset charset) throws IOException {
		Set<String> names = new LinkedHashSet<>();
		long total = 0;
		int count = 0;
		try (ZipInputStream in = new ZipInputStream(zip.getInputStream(), charset)) {
			ZipEntry entry;
			byte[] buffer = new byte[8192];
			while ((entry = in.getNextEntry()) != null) {
				if (++count > MAX_ENTRIES) {
					throw error("ZIP 안 파일이 너무 많습니다 (" + MAX_ENTRIES + "개 이하).");
				}
				// 읽으면서 센다 — 헤더의 크기 값은 조작할 수 있다
				int n;
				while ((n = in.read(buffer)) > 0) {
					total += n;
					if (total > MAX_TOTAL_BYTES) {
						throw error("ZIP 을 풀었을 때 너무 큽니다 (" + MAX_TOTAL_BYTES / 1024 / 1024 + "MB 이하).");
					}
				}
				String raw = entry.getName();
				if (isMacJunk(raw)) {
					continue;
				}
				String name = normalize(raw);
				if (entry.isDirectory() || name.isEmpty() || name.contains("/") || name.contains("\\") || name.equals(".") || name.equals("..")) {
					throw error("사진·파일은 폴더 없이 ZIP 바로 안에 넣어 주세요.");
				}
				if (name.endsWith(".zip")) {
					throw error("ZIP 안에 ZIP 은 넣을 수 없습니다.");
				}
				if (!names.add(name)) {
					throw error("ZIP 안에 같은 이름의 파일이 둘 이상 있습니다 (대소문자만 다른 것 포함): " + raw);
				}
			}
		}
		catch (ZipException e) {
			throw error("ZIP 파일을 읽을 수 없습니다.");
		}
		if (names.isEmpty()) {
			throw error("ZIP 파일이 비어 있거나 ZIP 형식이 아닙니다.");
		}
		return new Index(charset, names);
	}

	/** index 가 통과시킨 ZIP 에서 wanted 인 이름의 파일을 한 개씩 읽어 넘긴다 (한 번에 한 파일만 메모리에) */
	public void read(InputStreamSource zip, Charset charset, Predicate<String> wanted, Handler handler) throws IOException {
		try (ZipInputStream in = new ZipInputStream(zip.getInputStream(), charset)) {
			ZipEntry entry;
			while ((entry = in.getNextEntry()) != null) {
				if (isMacJunk(entry.getName())) {
					continue;
				}
				String name = normalize(entry.getName());
				if (!wanted.test(name)) {
					continue;
				}
				handler.accept(name, readLimited(in));
			}
		}
	}

	/** MAX_ENTRY_BYTES 까지만 읽는다. 넘으면 나머지는 버리고 null */
	private static byte[] readLimited(InputStream in) throws IOException {
		byte[] data = in.readNBytes((int) MAX_ENTRY_BYTES + 1);
		return data.length > MAX_ENTRY_BYTES ? null : data;
	}

	private static boolean isMacJunk(String rawName) {
		return rawName.startsWith("__MACOSX/") || rawName.equals(".DS_Store");
	}

	private static ValidationException error(String message) {
		return new ValidationException(Map.of(FIELD, message));
	}

}
