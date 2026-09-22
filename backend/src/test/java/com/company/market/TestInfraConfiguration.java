package com.company.market;

import java.io.IOException;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
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
 * 테스트·로컬 실행용 DB 인프라. Docker 가 있으면 운영과 같은 이미지(pgvector, redis), 없으면 내장 Postgres.
 * 내장 Postgres 는 Docker·Postgres 설치가 불가한 개발 PC 를 위한 임시 경로 (decisions.md 2026-09-21).
 * pgvector 확장과 Redis 가 없으므로 그걸 쓰는 테스트는 Docker 환경(CI)에서만 돈다.
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
