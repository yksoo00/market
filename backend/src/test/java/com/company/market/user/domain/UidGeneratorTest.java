package com.company.market.user.domain;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** uid = UP + yyMMdd + 일련번호 3자리 (decisions.md 2026-11-20) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class UidGeneratorTest {

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	TransactionTemplate tx;

	@Test
	@DisplayName("다음 번호: 없으면 001, 있으면 +1, 999 다음은 막는다")
	void nextNumber() {
		assertThat(UidGenerator.next("UP261008", null)).isEqualTo("UP261008001");
		assertThat(UidGenerator.next("UP261008", "UP261008009")).isEqualTo("UP261008010");
		assertThat(UidGenerator.next("UP261008", "UP261008998")).isEqualTo("UP261008999");
		assertThatThrownBy(() -> UidGenerator.next("UP261008", "UP261008999")).isInstanceOf(ApiException.class);
	}

	@Test
	@DisplayName("저장하면 UP+오늘(한국)+3자리 uid 가 붙고, 같은 트랜잭션에서 여러 명을 만들어도 번호가 이어진다")
	void assignsSequentialUidInOneTransaction() {
		List<String> ids = tx.execute(status -> {
			List<String> out = new ArrayList<>();
			for (int i = 0; i < 3; i++) {
				out.add(users.save(user("uidseq" + i, "0105550" + (100 + i))).getId());
			}
			return out;
		});
		String day = UidGenerator.todayPrefix();
		assertThat(ids).allSatisfy(id -> assertThat(id).matches(day + "\\d{3}"));
		int first = Integer.parseInt(ids.get(0).substring(day.length()));
		assertThat(ids).containsExactly(day + "%03d".formatted(first), day + "%03d".formatted(first + 1), day + "%03d".formatted(first + 2));
	}

	@Test
	@DisplayName("동시에 가입해도 uid 가 겹치지 않는다")
	void concurrentUidsAreUnique() throws Exception {
		int n = 8;
		ExecutorService pool = Executors.newFixedThreadPool(n);
		try {
			List<Future<String>> futures = new ArrayList<>();
			for (int i = 0; i < n; i++) {
				int k = i;
				Callable<String> job = () -> tx.execute(status -> users.save(user("uidcc" + k, "0105551" + (100 + k))).getId());
				futures.add(pool.submit(job));
			}
			Set<String> ids = new HashSet<>();
			for (Future<String> f : futures) {
				ids.add(f.get());
			}
			assertThat(ids).hasSize(n);
		}
		finally {
			pool.shutdownNow();
		}
	}

	private User user(String loginId, String phone) {
		return User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash").nickname(loginId).nicknameUsage("Y")
			.email(loginId + "@example.com").name("홍길동").phone(phone).phoneHash(hasher.hash(phone)).build();
	}

}
