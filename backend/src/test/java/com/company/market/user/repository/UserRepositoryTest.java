package com.company.market.user.repository;

import com.company.market.TestInfraConfiguration;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataIntegrityViolationException;
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

	private User.UserBuilder personal(String nickname) {
		return User.builder()
			.kind(UserKind.PERSONAL)
			.loginId(nickname + "id")
			.passwordHash("$2a$12$hash")
			.nickname(nickname)
			.nicknameUsage("Y")
			.email(nickname + "@example.com")
			.name("홍길동")
			.phone("01012345678");
	}

	@Test
	@DisplayName("저장 후 다시 읽으면 이름·휴대폰이 복호화되어 그대로 나온다")
	void roundTrip() {
		User saved = users.saveAndFlush(personal("nick1").build());

		User found = users.findById(saved.getId()).orElseThrow();
		assertThat(found.getName()).isEqualTo("홍길동");
		assertThat(found.getPhone()).isEqualTo("01012345678");
		assertThat(found.getDtReg()).isNotBlank();
		assertThat(found.getDtUpdate()).isNotBlank();
	}

	@Test
	@DisplayName("계정의 사용자 제공 컬럼으로 사용자 정보를 보관한다")
	void usesUnifiedUserColumns() {
		User saved = users.saveAndFlush(personal("nick2").build());

		User found = users.findById(saved.getId()).orElseThrow();
		assertThat(found.getKind()).isEqualTo(UserKind.PERSONAL);
		assertThat(found.getName()).isEqualTo("홍길동");
		assertThat(found.getPhone()).isEqualTo("01012345678");
	}

	@Test
	@DisplayName("personal 닉네임은 중복될 수 없다")
	void personalNicknameIsUnique() {
		users.saveAndFlush(personal("dup").build());

		assertThatThrownBy(() -> users.saveAndFlush(personal("dup").loginId("other01").email("other@example.com")
			.phone("01099998888").build())).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	@DisplayName("business 는 같은 기업명(닉네임)을 허용한다")
	void businessNicknameMayRepeat() {
		User first = users.saveAndFlush(User.builder().kind(UserKind.BUSINESS).loginId("1234567890").passwordHash("h")
			.name("담당자1").busRegId("1234567890").companyType("corporate").companyName("같은상호")
			.companyOpenDate("20200101").email("a@biz.com").build());
		User second = users.saveAndFlush(User.builder().kind(UserKind.BUSINESS).loginId("1234567891").passwordHash("h")
			.name("담당자2").busRegId("1234567891").companyType("corporate").companyName("같은상호")
			.companyOpenDate("20200101").email("b@biz.com").build());

		assertThat(first.getNickname()).isEqualTo(second.getNickname());
	}

}
