# market

IT 장비·솔루션 마켓플레이스. 개인·사업자가 상품을 올리고 채팅으로 거래. 견적서 PDF를 읽어 상품 등록 초안을 만들고, 챗봇으로 상품을 조회한다.
회사 프로젝트. 다른 사람이 이어받을 수 있게 만든다.

## 스택 (2026-09-18 확정)

| 층 | 기술 | 위치 |
|---|---|---|
| 프론트 | Next.js **16.3** (App Router), React 19.2, TypeScript 5.9 strict, Tailwind 4, shadcn/ui, pnpm 12, Node 24 LTS | `frontend/` |
| 백엔드 | Spring Boot **4.1** (3.x 아님), Java 21, Gradle 9 (wrapper), Spring Security, Spring Data JPA, Flyway | `backend/` |
| AI | Python 3.12, FastAPI 0.14x, uv | `ai/` |
| 데이터 | PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`), Redis 7, MinIO | `docker-compose.yml` |
| 프록시 | Caddy 2 | `infra/Caddyfile` |

버전을 올릴 때는 이 표를 먼저 고친다. 표에 없는 버전의 API·문법을 쓰지 않는다.
- Spring Boot **4.x**: 스타터 이름이 바뀜 (`starter-webmvc`, 모듈별 `-test` 스타터). 3.x·2.x 문법 금지. 확실치 않으면 `backend/build.gradle`을 먼저 본다.
- Next.js **16**: 학습 데이터와 다름. `frontend/AGENTS.md`가 시키는 대로 `node_modules/next/dist/docs/`를 먼저 읽는다.

## 매 세션 자동으로 함께 읽는 문서

@docs/tasks.md
@docs/lessons.md

## 참고 문서 (크므로 필요할 때 메시지에 @로 붙인다)

- `docs/architecture.md` — 뭐가 어디서 돌고 어떻게 연결되나
- `docs/decisions.md` — 왜 그렇게 정했나. **결정을 뒤집기 전에 반드시 읽는다**
- `docs/ai-api.md` — Spring ↔ ai HTTP 계약. 양쪽을 같은 PR에서 고친다
- `docs/security.md` — 인증·권한·입력·업로드·rate limit·챗봇·인프라 보안 정책과 수치
- `docs/prd.md`, `docs/data-model.md`, `docs/roles.md`, `docs/design.md` — 작성 예정

## 명령어

```
# 전체
docker compose up -d                 # postgres, redis, minio, caddy (dev 프로필)
docker compose logs -f <service>

# backend/
./gradlew bootRun                    # 실행
./gradlew test                       # 테스트. Docker 있으면 Testcontainers, 없으면 내장 Postgres (decisions.md 2026-09-21)
./gradlew check                      # 컴파일 + 테스트 + 정적 분석. 커밋 전 통과 필수

# frontend/
pnpm dev / pnpm build
pnpm typecheck / pnpm lint          # typecheck는 next typegen 포함
pnpm test                           # Vitest 설정 후

# ai/
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check . && uv run mypy .
```

## 저장소 구조

```
market/
├── CLAUDE.md, README.md, docker-compose.yml, .env.example
├── .claude/rules/       ← 경로별 세부 규칙 (backend, frontend, ai, db)
├── docs/                ← 위 참고 문서
├── backend/             ← Spring Boot. 도메인별 패키지 (user, listing, chat, organization, ai, common)
├── frontend/            ← Next.js
├── ai/                  ← FastAPI. quote, embed, chat
├── bruno/               ← API 요청 모음 (Bruno). 새 API 추가 시 같은 PR에서 요청 파일도
└── infra/               ← Caddyfile, 배포 스크립트, GitHub Actions
```

## 핵심 규칙 (항상)

### 아키텍처
- 모듈러 모놀리스. Spring 하나 + ai 하나. **서비스를 더 쪼개지 않는다.** MSA 아님.
- 백엔드는 stateless. 세션·파일·임시 데이터를 프로세스 메모리에 두지 않는다 → Redis, MinIO, Postgres.
- ai는 인증·권한·도메인 로직을 갖지 않는다. 입력 → 결과. 권한은 전부 Spring.
- 조회 캐시를 임의로 추가하지 않는다. 느린 것이 측정되면 상의 후 `common/cache` 경유.
- 라이브러리·의존성을 추가하기 전에 **먼저 물어본다.** 프레임워크 기본 기능으로 되는지 확인.

### 데이터
- 스키마 변경은 항상 Flyway 마이그레이션 파일. 콘솔·JPA ddl-auto로 바꾸지 않는다.
- 마이그레이션은 직전 배포 버전과 호환 (무중단). 컬럼 이름 변경·삭제는 배포 2회로 나눈다.
- 판매 주체는 `seller_user_id` 또는 `seller_org_id` 둘 중 하나. User FK 하나로 퉁치지 않는다.
- 권한은 역할 기반. `isAdmin` 같은 불리언 한 개로 처리하지 않는다.
- 삭제는 soft delete (`deleted_at`). 실제 DELETE 금지 (listings, messages, users).
- 이미지·파일은 MinIO 경로만 DB에 저장. URL 저장 금지.

### 보안
- 입력 검증은 **세 층 전부**: 프론트(zod, 입력 즉시 피드백) → 백엔드(Bean Validation, 같은 규칙) → ai(pydantic). 어느 층도 다른 층을 믿고 생략하지 않는다. 규칙 수치는 `docs/security.md` "입력 검증"이 원본이고 프론트·백엔드가 같은 값을 쓴다.
- 프론트는 검증 결과에 반드시 반응한다: 필드 옆 오류 문구, 제출 버튼 비활성/활성, 서버가 돌려준 필드 오류를 해당 필드에 표시. 오류를 조용히 삼키지 않는다.
- 클라이언트가 보낸 `userId`를 신뢰하지 않는다.
- 비밀값은 `.env`에만. 코드·로그·커밋에 절대 넣지 않는다. `.env.example`에는 키 이름만.
- 챗봇은 미리 정의된 읽기 전용 조회 함수만 호출. LLM이 SQL을 생성하게 하지 않는다.
- 견적서 파싱 결과는 초안. 사용자 확인 없이 게시하지 않는다.
- 개인정보(이메일·전화·계좌)는 API 응답·로그·챗봇 결과에 노출하지 않는다.

### 작업 방식
- 작업 전 `@docs/tasks.md`를 읽고, 끝나면 갱신한다.
- 큰 작업은 먼저 계획을 보여주고 승인 후 구현한다. 한 번에 한 기능.
- 코드를 바꾸면 해당 테스트를 같이 바꾼다. 테스트 없이 "동작할 것"이라고 말하지 않는다.
- 결정을 바꾸면 `docs/decisions.md`에 이유를 추가한다. 기존 항목은 지우지 않고 아래에 덧붙인다.
- 스키마를 바꾸면 `docs/data-model.md`를 같은 커밋에서 갱신한다.
- 모르는 것은 추측하지 말고 묻는다.

행동 원칙(가정 명시, 단순함, 외과적 수정, 목표 기반 실행)은 `.claude/rules/behavior.md`. 항상 로드되며 이 파일과 함께 적용된다.

### "왜"를 남기는 규칙 (나중에 헷갈리지 않게)
- **큰 결정** (스택, 구조, 정책, 라이브러리 선택) → `docs/decisions.md`. 날짜, 결정, 이유, 대안, 재검토 조건.
- **코드 안의 이유** → 주석. "무엇을"이 아니라 "왜". 코드만 봐서는 이유를 알 수 없는 곳에만 쓴다.
  - 쓴다: `// 카카오는 이메일 동의를 안 하면 null로 줌. 그래서 nullable`
  - 안 쓴다: `// 사용자를 조회한다` (코드가 이미 말함)
  - 우회·임시 처리에는 반드시: `// TODO(이유): ... 언제 제거`
- **커밋의 이유** → 커밋 메시지 본문. 제목은 "무엇을", 본문은 "왜"와 "다른 방법 대신 이걸 고른 이유". 한 줄짜리 커밋은 사소한 변경만.
- **Claude가 틀렸던 것** → `docs/lessons.md`. 같은 실수가 두 번 나오면 여기 적고, 세 번이면 이 파일의 규칙으로 승격.
- 세션을 시작할 때 `decisions.md`와 `lessons.md`를 읽고, 거기 적힌 것과 반대로 하려면 먼저 이유를 말한다.

## Git

- 브랜치: `main`(배포 상태, 직접 푸시 금지) ← `feat/<기능>`, `fix/<버그>`, `db/<스키마변경>`, `docs/<문서>`, `chore/<잡무>`
- 예외 (2026-09-21, 1인 개발 동안): `docs/`, `CLAUDE.md`, `.claude/`, 코드 주석만 바꾸는 커밋은 main 직접. 실행 결과가 바뀌는 변경은 아무리 작아도 브랜치.
- 코드 브랜치는 **푸시 후 PR로 머지** (1인이라 셀프 머지). PR 본문이 그 기능의 설명서 — 무엇을·왜·확인 방법. 머지 후 브랜치 삭제. 브랜치 보호는 force push·삭제 금지 + CI 통과만 (PR 필수는 팀원 생기면).
- 스키마 변경은 `db/` 브랜치로 분리. 코드 변경과 섞지 않는다.
- 커밋: Conventional Commits + 범위. `feat(backend): 카카오 로그인 콜백`, `fix(frontend): 채팅 재접속 시 중복 메시지`, `db: listings에 seller_org_id 추가`
- 커밋은 작동하는 상태에서, 작게, 자주. 한 커밋에 한 가지.
- 머지 전: `./gradlew check` + `pnpm typecheck && pnpm lint && pnpm test` + `uv run pytest` 통과, `/code-review` 실행. 스키마·인증·권한 변경은 `/security-review`도.
- 배포 시 태그 `vX.Y.Z`.
- `.env*`, `CLAUDE.local.md`는 `.gitignore`. 키가 한 번이라도 올라가면 재발급.

## 언어

- 코드 주석·커밋 메시지·문서: 한국어. 식별자(변수·함수·클래스·테이블): 영어.
- 사용자에게 보이는 문구는 `frontend/src/messages/`에 모아둔다. 컴포넌트에 하드코딩하지 않는다.
