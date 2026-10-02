package com.company.market.common.storage;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * 올릴 수 있는 파일 형식. 확장자와 파일 앞부분(매직 바이트)이 둘 다 맞아야 그 형식으로 본다 —
 * 브라우저가 보내는 Content-Type 은 사용자가 마음대로 바꿀 수 있어서 믿지 않는다 (security.md "파일 업로드").
 */
public enum FileType {

	JPG("jpg", "image/jpeg"),
	PNG("png", "image/png"),
	WEBP("webp", "image/webp"),
	PDF("pdf", "application/pdf");

	private static final byte[] JPG_MAGIC = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };

	private static final byte[] PNG_MAGIC = { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

	private static final byte[] RIFF = "RIFF".getBytes(StandardCharsets.US_ASCII);

	private static final byte[] WEBP_TAG = "WEBP".getBytes(StandardCharsets.US_ASCII);

	private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

	/** 매직 바이트 검사에 필요한 앞부분 길이 (webp 가 가장 길다: RIFF + 크기 4 + WEBP) */
	public static final int HEAD_LENGTH = 12;

	private final String extension;

	private final String contentType;

	FileType(String extension, String contentType) {
		this.extension = extension;
		this.contentType = contentType;
	}

	public String extension() {
		return extension;
	}

	public String contentType() {
		return contentType;
	}

	public static Optional<FileType> fromFilename(String filename) {
		if (filename == null) {
			return Optional.empty();
		}
		int dot = filename.lastIndexOf('.');
		if (dot < 0) {
			return Optional.empty();
		}
		String ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
		if (ext.equals("jpeg")) {
			return Optional.of(JPG);
		}
		return Arrays.stream(values()).filter(t -> t.extension.equals(ext)).findFirst();
	}

	/** head 는 파일 앞부분. 짧으면(빈 파일 등) 거부 */
	public boolean matches(byte[] head) {
		return switch (this) {
			case JPG -> startsWith(head, JPG_MAGIC, 0);
			case PNG -> startsWith(head, PNG_MAGIC, 0);
			case WEBP -> startsWith(head, RIFF, 0) && startsWith(head, WEBP_TAG, 8);
			case PDF -> startsWith(head, PDF_MAGIC, 0);
		};
	}

	private static boolean startsWith(byte[] head, byte[] magic, int offset) {
		if (head.length < offset + magic.length) {
			return false;
		}
		return Arrays.equals(head, offset, offset + magic.length, magic, 0, magic.length);
	}

}
