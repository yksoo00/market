package com.company.market.common.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.company.market.common.config.AppProperties;
import com.company.market.user.domain.UserRole;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

/**
 * access 토큰 (JWT HS256, 15분, stateless). 페이로드는 user_id·role·만료만 — 개인정보 없음 (security.md "인증").
 * 라이브러리는 이미 있는 spring-security-oauth2-jose(nimbus) 를 쓴다.
 */
@Component
public class JwtProvider {

	private static final String ROLE_CLAIM = "role";

	private final JwtEncoder encoder;

	private final JwtDecoder decoder;

	private final Duration accessTtl;

	public JwtProvider(AppProperties props) {
		byte[] secret = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
		if (secret.length < 32) {
			throw new IllegalArgumentException("JWT_SECRET 은 32바이트 이상이어야 함 (HS256)");
		}
		SecretKey key = new SecretKeySpec(secret, "HmacSHA256");
		this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
		this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
		this.accessTtl = Duration.ofMinutes(props.jwt().accessTtlMinutes());
	}

	public Duration accessTtl() {
		return accessTtl;
	}

	public String createAccessToken(UUID userId, UserRole role) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.subject(userId.toString())
			.claim(ROLE_CLAIM, role.name())
			.issuedAt(now)
			.expiresAt(now.plus(accessTtl))
			.id(UUID.randomUUID().toString())
			.build();
		return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
	}

	/** 서명·만료가 맞지 않으면 empty. 이유는 구분하지 않는다 (호출자는 전부 401) */
	public Optional<AuthenticatedUser> parse(String token) {
		try {
			Jwt jwt = decoder.decode(token);
			String role = jwt.getClaimAsString(ROLE_CLAIM);
			if (jwt.getSubject() == null || role == null) {
				return Optional.empty();
			}
			return Optional.of(new AuthenticatedUser(UUID.fromString(jwt.getSubject()), UserRole.valueOf(role)));
		}
		catch (JwtException | IllegalArgumentException e) {
			return Optional.empty();
		}
	}

}
