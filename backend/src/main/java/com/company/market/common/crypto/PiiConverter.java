package com.company.market.common.crypto;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 개인정보 컬럼(이름·휴대폰·CI·DI·소셜 이메일) AES-256-GCM 암호화 (data-model.md 결정 4).
 * 저장 형식: base64(iv 12바이트 ‖ 암호문+태그). 암호화 컬럼은 = 검색이 안 되므로 조회는 별도 해시 컬럼으로.
 * 키는 한 번 정하면 못 바꿈 (바꾸면 전체 재암호화 필요).
 */
@Component
@Converter
public class PiiConverter implements AttributeConverter<String, String> {

	private static final int IV_BYTES = 12;
	private static final int TAG_BITS = 128;

	private final SecretKeySpec key;
	private final SecureRandom random = new SecureRandom();

	public PiiConverter(@Value("${app.pii-key}") String base64Key) {
		byte[] raw = Base64.getDecoder().decode(base64Key);
		if (raw.length != 32) {
			throw new IllegalArgumentException("PII_ENCRYPTION_KEY 는 32바이트 base64 여야 함 (현재 " + raw.length + "바이트)");
		}
		this.key = new SecretKeySpec(raw, "AES");
	}

	@Override
	public String convertToDatabaseColumn(String plain) {
		if (plain == null) {
			return null;
		}
		try {
			byte[] iv = new byte[IV_BYTES];
			random.nextBytes(iv);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
			byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
			return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array());
		}
		catch (GeneralSecurityException e) {
			throw new IllegalStateException("PII 암호화 실패", e);
		}
	}

	@Override
	public String convertToEntityAttribute(String stored) {
		if (stored == null) {
			return null;
		}
		try {
			ByteBuffer buf = ByteBuffer.wrap(Base64.getDecoder().decode(stored));
			byte[] iv = new byte[IV_BYTES];
			buf.get(iv);
			byte[] encrypted = new byte[buf.remaining()];
			buf.get(encrypted);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
			return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
		}
		catch (GeneralSecurityException e) {
			throw new IllegalStateException("PII 복호화 실패", e);
		}
	}

}
