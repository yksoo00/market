package com.company.market.user.repository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserRepositoryTest {

	@Autowired
	UserRepository users;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	PiiHasher hasher;

	private User.UserBuilder personal(String nickname) {
		return User.builder()
			.kind(UserKind.PERSONAL)
			.loginId(nickname + "id")
			.passwordHash("$2a$12$hash")
			.nickname(nickname)
			.email(nickname + "@example.com")
			.name("홍길동")
			.phone("01012345678")
			.phoneHash(hasher.hash("01012345678"));
	}

	@Test
	@DisplayName("저장 후 다시 읽으면 이름·휴대폰이 복호화되어 그대로 나온다")
	void roundTrip() {
		User saved = users.saveAndFlush(personal("nick1").build());

		User found = users.findById(saved.getId()).orElseThrow();
		assertThat(found.getName()).isEqualTo("홍길동");
		assertThat(found.getPhone()).isEqualTo("01012345678");
		assertThat(found.getCreatedAt()).isNotNull();
		assertThat(found.getUpdatedAt()).isNotNull();
	}

	@Test
	@DisplayName("DB 컬럼에는 이름·휴대폰이 평문으로 남지 않고, phone_hash 는 키 있는 해시다")
	void piiIsEncryptedAtRest() throws Exception {
		User saved = users.saveAndFlush(personal("nick2").build());

		Map<String, Object> row = jdbc.queryForMap("select name, phone, phone_hash, kind from users where id = ?", saved.getId());
		assertThat((String) row.get("name")).isNotEqualTo("홍길동").doesNotContain("홍길동");
		assertThat((String) row.get("phone")).doesNotContain("01012345678");
		assertThat(row.get("phone_hash")).isEqualTo(hasher.hash("01012345678")).isNotEqualTo(sha256Hex("01012345678"));
		assertThat(row.get("kind")).isEqualTo("personal");
	}

	@Test
	@DisplayName("personal 닉네임은 중복될 수 없다")
	void personalNicknameIsUnique() {
		users.saveAndFlush(personal("dup").build());

		assertThatThrownBy(() -> users.saveAndFlush(personal("dup").loginId("other").email("o@example.com").phone("01099998888").phoneHash(hasher.hash("01099998888")).build()))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("business 는 같은 기업명(닉네임)을 허용한다")
	void businessNicknameMayRepeat() {
		users.saveAndFlush(User.builder().kind(UserKind.BUSINESS).passwordHash("h").nickname("같은상호").email("a@biz.com").build());
		users.saveAndFlush(User.builder().kind(UserKind.BUSINESS).passwordHash("h").nickname("같은상호").email("b@biz.com").build());

		assertThat(jdbc.queryForObject("select count(*) from users where nickname = ?", Long.class, "같은상호")).isEqualTo(2L);
	}

	private static String sha256Hex(String s) throws Exception {
		return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
	}

}
