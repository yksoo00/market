package com.company.market.common.storage;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 업로드 용도. 형식이 아니라 용도로 받는 이유: 같은 PDF 라도 용도마다 폴더·열람 권한·크기가 다르다.
 * 폴더 1단의 public/private 이 열람 권한을 정한다 — 전달 코드가 실수로 비공개 파일을 내주지 않게
 * (decisions.md 2026-10-02, 스펙 docs/superpowers/specs/2026-10-02-file-upload-design.md).
 */
public enum UploadKind {

	LISTING_PHOTO("listing-photo", "public/listings/photos", 5, Set.of(FileType.JPG, FileType.PNG, FileType.WEBP)),
	LISTING_DATASHEET("listing-datasheet", "private/listings/datasheets", 10, Set.of(FileType.PDF)),
	LISTING_TEST_REPORT("listing-test-report", "private/listings/test-reports", 10, Set.of(FileType.PDF, FileType.JPG, FileType.PNG)),
	LISTING_CERTIFICATE("listing-certificate", "private/listings/certificates", 10, Set.of(FileType.PDF, FileType.JPG, FileType.PNG)),
	LISTING_REPLACE_PROD("listing-replace-prod", "private/listings/replace-prods", 10, Set.of(FileType.PDF, FileType.JPG, FileType.PNG));

	private static final long MB = 1024 * 1024;

	/** 폴더/yyyy/MM/uuid.ext — 이 모양이 아니면 저장·열람·등록 어디에도 쓰지 않는다 ("../" 같은 경로 조작 차단) */
	private static final String KEY_TAIL = "/\\d{4}/\\d{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|pdf)";

	private final String value;

	private final String folder;

	private final long maxBytes;

	private final Set<FileType> allowed;

	private final Pattern keyPattern;

	UploadKind(String value, String folder, int maxMegabytes, Set<FileType> allowed) {
		this.value = value;
		this.folder = folder;
		this.maxBytes = maxMegabytes * MB;
		this.allowed = allowed;
		this.keyPattern = Pattern.compile(Pattern.quote(folder) + KEY_TAIL);
	}

	public String value() {
		return value;
	}

	public String folder() {
		return folder;
	}

	public long maxBytes() {
		return maxBytes;
	}

	public boolean allows(FileType type) {
		return allowed.contains(type);
	}

	public boolean isPublic() {
		return folder.startsWith("public/");
	}

	public String newKey(FileType type, Clock clock) {
		LocalDate today = LocalDate.now(clock);
		return "%s/%04d/%02d/%s.%s".formatted(folder, today.getYear(), today.getMonthValue(), UUID.randomUUID(), type.extension());
	}

	public static Optional<UploadKind> fromValue(String value) {
		return Arrays.stream(values()).filter(k -> k.value.equals(value)).findFirst();
	}

	public static Optional<UploadKind> ofKey(String key) {
		if (key == null) {
			return Optional.empty();
		}
		return Arrays.stream(values()).filter(k -> k.keyPattern.matcher(key).matches()).findFirst();
	}

}
