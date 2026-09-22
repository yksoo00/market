package com.company.market;

import java.io.IOException;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import redis.embedded.RedisServer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 테스트·로컬 실행용 인프라. Docker 가 있으면 운영과 같은 이미지(pgvector, redis), 없으면 내장 Postgres·Redis 바이너리.
 * 내장 경로는 Docker·설치가 불가한 개발 PC 를 위한 임시 경로 (decisions.md 2026-09-21). Docker 가 되면 DockerUnavailable 빈 전부 삭제.
 * 내장 Postgres 에는 pgvector 확장이 없으므로 vector 를 쓰는 테스트는 Docker 환경(CI)에서만 돈다.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestInfraConfiguration {

	private static final boolean DOCKER_AVAILABLE = DockerClientFactory.instance().isDockerAvailable();

	@Bean
	@ServiceConnection
	@Conditional(DockerAvailable.class)
	PostgreSQLContainer postgresContainer() {
		// 운영과 같은 이미지(pgvector). postgres:latest 쓰면 vector 확장 테스트가 안 됨
		return new PostgreSQLContainer(
				DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
	}

	@Bean
	@ServiceConnection(name = "redis")
	@Conditional(DockerAvailable.class)
	GenericContainer<?> redisContainer() {
		return new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);
	}

	@Bean(destroyMethod = "close")
	@Conditional(DockerUnavailable.class)
	EmbeddedPostgres embeddedPostgres() throws IOException {
		return EmbeddedPostgres.start();
	}

	@Bean
	@Conditional(DockerUnavailable.class)
	DynamicPropertyRegistrar embeddedPostgresProperties(EmbeddedPostgres postgres) {
		return registry -> {
			registry.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
			registry.add("spring.datasource.username", () -> "postgres");
			registry.add("spring.datasource.password", () -> "postgres");
		};
	}

	@Bean(initMethod = "start", destroyMethod = "stop")
	@Conditional(DockerUnavailable.class)
	RedisServer embeddedRedis() throws IOException {
		// 포트 0 이 안 되므로 빈 포트를 찍어서 넘긴다. bind 127.0.0.1 은 Windows 방화벽 팝업 방지
		int port = freePort();
		return RedisServer.newRedisServer().port(port).setting("bind 127.0.0.1").build();
	}

	@Bean
	@Conditional(DockerUnavailable.class)
	DynamicPropertyRegistrar embeddedRedisProperties(RedisServer redis) {
		return registry -> registry.add("spring.data.redis.url", () -> "redis://127.0.0.1:" + redis.ports().getFirst());
	}

	private static int freePort() throws IOException {
		try (java.net.ServerSocket socket = new java.net.ServerSocket(0)) {
			return socket.getLocalPort();
		}
	}

	static class DockerAvailable implements Condition {
		@Override
		public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
			return DOCKER_AVAILABLE;
		}
	}

	static class DockerUnavailable implements Condition {
		@Override
		public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
			return !DOCKER_AVAILABLE;
		}
	}

}
