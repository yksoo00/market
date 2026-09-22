package com.company.market.common.crypto;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 암호화 컬럼 옆에 두는 검색용 해시 (users.phone_hash, identity_verifications.ci_hash).
 * 키 없는 sha256 이면 휴대폰(경우의 수 ~10^8)은 DB 유출 시 바로 역산되므로 HMAC-SHA256.
 * 키는 별도 환경변수 대신 PII 암호화 키에서 파생 — 관리할 비밀값을 하나로 유지.
 * 정규화된 값(숫자만 등)을 넣는다. 서비스 계층에서 계산해 엔티티에 넘긴다 (엔티티는 빈 주입 불가).
 */
@Component
public class PiiHasher {

	private static final String ALGORITHM = "HmacSHA256";

	private final SecretKeySpec hashKey;

	public PiiHasher(@Value("${app.pii-key}") String base64Key) {
		byte[] raw = Base64.getDecoder().decode(base64Key);
		if (raw.length != 32) {
			throw new IllegalArgumentException("PII_ENCRYPTION_KEY 는 32바이트 base64 여야 함 (현재 " + raw.length + "바이트)");
		}
		// 파생: HMAC(암호화 키, "pii-hash"). 암호화 키를 MAC 키로 직접 재사용하지 않기 위해
		this.hashKey = new SecretKeySpec(hmac(new SecretKeySpec(raw, ALGORITHM), "pii-hash"), ALGORITHM);
	}

	public String hash(String value) {
		return HexFormat.of().formatHex(hmac(hashKey, value));
	}

	private static byte[] hmac(SecretKeySpec key, String data) {
		try {
			Mac mac = Mac.getInstance(ALGORITHM);
			mac.init(key);
			return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
		}
		catch (GeneralSecurityException e) {
			throw new IllegalStateException("PII 해시 실패", e);
		}
	}

}
