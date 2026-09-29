package com.company.market;

import java.time.Duration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/** 테스트 인프라(Postgres·Redis)가 Docker 컨테이너에 실제로 붙는지 확인한다. 다른 테스트가 막연히 실패할 때 먼저 볼 것 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class TestInfraSmokeTest {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	StringRedisTemplate redis;

	@Test
	@DisplayName("Postgres 16 에 연결된다")
	void postgres() {
		assertThat(jdbc.queryForObject("show server_version", String.class)).startsWith("16.");
	}

	@Test
	@DisplayName("Redis 에 쓰고 읽고 TTL 이 걸린다")
	void redis() {
		redis.opsForValue().set("smoke:key", "ok", Duration.ofSeconds(30));

		assertThat(redis.opsForValue().get("smoke:key")).isEqualTo("ok");
		assertThat(redis.getExpire("smoke:key")).isBetween(1L, 30L);
		redis.delete("smoke:key");
	}

}
