---
paths:
  - "backend/**"
---

# Backend (Spring Boot 4.1, Java 21)

## Boot 4.x 주의 (학습 데이터의 3.x와 다름)
- 스타터: `spring-boot-starter-webmvc` (web 아님), `spring-boot-starter-security-oauth2-client`, `spring-boot-starter-flyway`. 테스트는 모듈별 `spring-boot-starter-*-test`.
- Testcontainers 패키지: `org.testcontainers.postgresql.PostgreSQLContainer`, `org.testcontainers:testcontainers-junit-jupiter`.
- Jackson 3: `tools.jackson.databind.ObjectMapper` (`com.fasterxml.jackson.databind` 아님). 어노테이션(`@JsonInclude` 등)만 `com.fasterxml.jackson.annotation` 그대로.
- 테스트 어노테이션 패키지: `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc` 등 모듈별 (`org.springframework.boot.test.autoconfigure.web.servlet` 아님).
- 의존성 추가 전 `build.gradle`의 기존 이름 패턴을 따른다. 모르면 https://start.spring.io 메타데이터 확인.
- 설정은 `application.yml` 하나 + 환경변수. 프로필별 파일은 `application-test.yml`만.

## 패키지 구조
```
com.company.market
├── user/           controller, service, repository, domain(엔티티), dto
├── listing/
├── organization/
└── common/         auth, config, exception, cache, storage
```
- 도메인 패키지끼리는 **service를 통해서만** 호출. 다른 도메인의 repository 직접 접근 금지.
- `controller → service → repository`. 역방향 참조 금지. controller에 비즈니스 로직 금지, repository에 권한 검사 금지.

## 코드 컨벤션
- Java 21 문법 사용 (record, sealed, switch pattern). 필드 주입 금지, 생성자 주입 (`@RequiredArgsConstructor` 또는 명시 생성자).
- DTO는 record. 엔티티를 API 응답으로 직접 반환하지 않는다.
- 엔티티: `@Id` UUID, `createdAt`/`updatedAt` 공통 base 클래스, soft delete는 `deletedAt`.
- 예외: `common/exception`의 도메인 예외(`ApiException(ErrorCode)`) → 전역 핸들러가 `{ ok: false, code, message }`로 변환. 컨트롤러에서 try-catch 금지. 오류 코드는 `ErrorCode` enum 하나에 모은다 — 기능별 enum 으로 쪼개지 않고 `// 공통 / 인증 / 가입` 주석으로 묶음. 코드 이름은 프론트 `messages/*.ts` 의 errors 키와 같다. 새 코드 추가 시 프론트 문구도 같은 PR.
- 트랜잭션 경계는 service. `@Transactional(readOnly = true)`를 조회 기본값으로.
- N+1 주의: 목록 조회는 fetch join 또는 별도 쿼리. `open-in-view=false`.
- 로그: SLF4J. `RequestIdFilter` 가 `requestId`, `JwtAuthenticationFilter` 가 `userId` 를 MDC 에 넣으므로 로그 메시지에 다시 쓰지 않아도 된다. 개인정보(아이디·이메일·휴대폰·이름) 로그 금지 — userId·IP 만. 보안 이벤트(잠금·정지 시도·재사용 감지)는 WARN.
- 시간은 `Instant`(UTC) 저장. 표시 변환은 프론트.
- Lombok은 `@Getter`, `@Builder`, `@RequiredArgsConstructor`만. `@Data`, `@Setter` 금지.

## API
- 경로 `/api/v1/...`. 리소스 복수형. `GET /api/v1/listings/{id}`.
- 응답 `{ ok, data }` / `{ ok, code, message }`. 목록은 `{ items, nextCursor }` 커서 페이지네이션. offset 페이지네이션 금지.
- 현재 사용자는 `@AuthenticationPrincipal`로만. 요청 본문의 userId 사용 금지.
- 모든 요청 DTO에 Bean Validation (`@Valid`, `@NotBlank`, `@Size`, `@Min/@Max` …). 프론트가 검증했다고 생략하지 않는다. 수치는 `docs/security.md` "입력 검증"과 동일.
- 검증 실패 응답은 400 + `{ ok: false, code: "VALIDATION", message, fields: { "<필드>": "<문구>" } }`. 프론트가 필드별로 표시하므로 필드명은 요청 DTO 필드명 그대로.
- 형식은 맞지만 상태가 안 맞는 경우(예: 이미 사용 중인 이메일, 예약중인 글 수정)는 409/422 + 같은 형태.
- 쓰기 API에는 rate limit (Redis 카운터).

## 인증
- JWT access 15분(stateless) + refresh 30일(Redis `session:{userId}:{deviceId}`).
- 소셜 로그인은 구현 후 일시 주석 처리 상태다. 사용자 지시 전까지 OAuth 경로를 노출하지 않는다.
- 권한 검사는 `common/auth/Permission` 한 곳. 컨트롤러·서비스에 role 문자열 비교 흩뿌리지 않는다.

## 테스트
- 서비스: 단위 테스트 (Mockito). 리포지토리·API: Testcontainers Postgres로 통합 테스트.
- 통합 테스트는 `TestInfraConfiguration` 을 `@Import`. Testcontainers(`pgvector/pgvector:pg16`, `redis:7-alpine`)만 쓰며 Docker 가 없으면 실패한다 (decisions.md 2026-09-23).
- 새 API마다 최소: 정상 1개, 권한 없음 1개, 잘못된 입력 1개.
- 새 API마다 `bruno/` 에 요청 파일 추가 (폴더는 도메인별: `bruno/auth/`, `bruno/listings/` …). 환경 변수는 `bruno/environments/local.bru`.
- 테스트 이름은 한국어 `@DisplayName`으로 의도 표현.

## 하지 말 것
- `spring.jpa.hibernate.ddl-auto=update/create`. 항상 `validate`.
- Redis에 메시지 본문·게시글·사용자 정보 저장.
- 정적 유틸 클래스에 비즈니스 로직.
