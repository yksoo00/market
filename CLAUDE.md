# market

IT 장비·솔루션 마켓플레이스. Spring Boot 4.1 (Java 21) + Next.js 16, PostgreSQL 16 + pgvector, Redis 7.
AI 기능(견적서 파싱·추천·챗봇)은 보류 — `ai/` 서비스는 제거했고 재개 시 다시 만든다 (decisions.md 2026-09-29).

## 문서

자동 로드: 이 파일, `.claude/rules/behavior.md`(항상), `.claude/rules/{backend,frontend,db}.md`(해당 경로 작업 시).

`docs/`는 자동 로드되지 않는다. 아래 "언제"에 해당하는 작업이면 **코드를 바꾸기 전에** 그 문서를 읽거나 `@`로 붙인다 (한 번에 1~3개, 사소한 수정엔 안 붙임). `lessons.md`만 세션 시작 때 읽는다.

| 문서 | 답하는 질문 | 언제 |
|---|---|---|
| `docs/architecture.md` | 뭐가 어디서 돌고 어떻게 연결되나 | 배포·compose·인프라를 건드리거나 전체 흐름을 파악할 때 |
| `docs/decisions.md` | 왜 그렇게 정했나. 맨 위에 현재 유효한 결정 색인 | 구조·정책·화면 구성의 큰 흐름을 바꾸기 전(색인부터). **결정을 뒤집기 전에 반드시**. 큰 결정을 내리면 여기에 추가 |
| `docs/data-model.md` | 어떤 데이터를 저장하나 | 테이블·마이그레이션을 만들거나 바꿀 때 |
| `docs/security.md` | 인증·권한·입력·업로드·rate limit·인프라 정책과 수치 | 인증·권한·업로드·rate limit·입력 검증 수치를 건드릴 때 |
| `docs/design.md` | 어떻게 보이나 (색·폰트·간격·그림자·컴포넌트 규격) | 화면·스타일·컴포넌트 모양을 만들거나 바꿀 때 |
| `docs/lessons.md` | Claude가 틀렸던 것 | 세션 시작 시 |

미작성: `prd.md`(기능 범위), `roles.md`(권한표). 해당 기능 구현 전에 작성한다. 모르는 건 "미정"으로 적고 비워두지 않는다.

## 명령어

```
# 전체
docker compose up -d                 # postgres, redis
docker compose logs -f <service>

# backend/
./gradlew bootRun                    # 실행
./gradlew test                       # 테스트. Docker Desktop 실행 필수 (Testcontainers Postgres·Redis)
./gradlew check                      # 컴파일 + 테스트 + 정적 분석. 커밋 전 통과 필수

# frontend/
pnpm dev / pnpm build
pnpm typecheck / pnpm lint          # typecheck는 next typegen 포함
pnpm test                           # Vitest (lib·hook 단위. *.test.ts)
```

## 저장소 구조

```
market/
├── CLAUDE.md, README.md, docker-compose.yml, .env.example
├── .claude/rules/       ← 경로별 세부 규칙 (backend, frontend, db) + behavior
├── docs/                ← 위 문서
├── backend/             ← Spring Boot. 도메인별 패키지 (현재 user, organization, common. 목표: listing 추가. 채팅 없음)
├── frontend/            ← Next.js. 현재 홈(mock)·로그인·가입 화면
├── bruno/               ← API 요청 모음 (Bruno). 새 API 추가 시 같은 PR에서 요청 파일도
├── infra/               ← 보류된 Caddyfile
└── .github/workflows/   ← CI
```

## 핵심 규칙 (항상)

### 아키텍처

- 모듈러 모놀리스. Spring 하나. **서비스를 더 쪼개지 않는다.** MSA 아님. (AI 재개 시 FastAPI 1개만 예외)
- 백엔드는 stateless. 세션·임시 데이터를 프로세스 메모리에 두지 않는다 → Redis, Postgres. 파일 저장소는 업로드 기능 구현 시 결정한다.
- 조회 캐시를 임의로 추가하지 않는다. 느린 것이 측정되면 상의 후 `common/cache` 경유.
- 라이브러리·의존성을 추가하기 전에 **먼저 물어본다.** 프레임워크 기본 기능으로 되는지 확인.

### 데이터

- 스키마 변경은 항상 Flyway 마이그레이션 파일. 콘솔·JPA ddl-auto로 바꾸지 않는다.
- 마이그레이션은 직전 배포 버전과 호환 (무중단). 컬럼 이름 변경·삭제는 배포 2회로 나눈다.
- 판매 주체는 `seller_user_id` 또는 `seller_org_id` 둘 중 하나. User FK 하나로 퉁치지 않는다.
- 권한은 역할 기반. `isAdmin` 같은 불리언 한 개로 처리하지 않는다.
- 이미지·파일은 경로 저장

### 보안

- 입력 검증은 **두 층 전부**: 프론트(zod, 입력 즉시 피드백) → 백엔드(Bean Validation, 같은 규칙). 어느 층도 다른 층을 믿고 생략하지 않는다. 규칙 수치는 `docs/security.md` "입력 검증"이 원본이고 프론트·백엔드가 같은 값을 쓴다.
- 프론트는 검증 결과에 반드시 반응한다: 필드 옆 오류 문구, 제출 버튼 비활성/활성, 서버가 돌려준 필드 오류를 해당 필드에 표시. 오류를 조용히 삼키지 않는다.
- 클라이언트가 보낸 `userId`를 신뢰하지 않는다.
- 비밀값은 `.env`에만. 코드·로그·커밋에 절대 넣지 않는다. `.env.example`에는 키 이름만.
- 개인정보(이메일·전화·계좌)는 API 응답·로그에 노출하지 않는다.

### 작업 방식

- 워크플로는 `superpowers`(분석 → 계획 → 구현 → 테스트 → 디버깅 → 검증). 요구사항·아키텍처·보안·데이터 모델·UX가 코드와 문서를 확인한 뒤에도 미결정일 때만 `grill-me`(사용자 호출 전용. Claude는 같은 내용인 `grilling`을 부른다)로 WHAT/WHY를 정하고, 정해지면 멈춘다. 사소하거나 명확한 작업엔 생략.
- 큰 작업은 먼저 계획을 보여주고 승인 후 구현한다. 한 번에 한 기능.
- 현재 동작은 코드·테스트가 기준. 문서와 다르면 코드를 따르되, 정책 의도가 불명확하면 묻는다. 관련 기능의 기존 구현·호출 흐름·패턴을 먼저 확인하고 따른다.
- 코드·문서·테스트로 판단되는 건 묻지 않고, 이미 결정된 건 다시 묻지 않는다. 그 외 모르는 것은 추측하지 말고 묻는다.
- 코드를 바꾸면 해당 테스트를 같이 바꾼다. 테스트 없이 "동작할 것"이라고 말하지 않는다.
- 결과 보고에는 구현 선택 이유와 다른 영역(API·데이터 흐름·UI·공통 모듈) 영향 검토를 포함한다.
- 결정을 바꾸면 `docs/decisions.md`에 이유를 추가한다. 기존 항목은 지우지 않고 아래에 덧붙인다.
- `git checkout -- <path>`, `git restore`, `git reset --hard` 등 미커밋 변경을 버리는 명령은 사용자 명시 요청 없이 쓰지 않는다. 복구가 필요하면 직접 수정한다.
- 인코딩: UTF-8(BOM 없음). 한글 파일은 필요한 줄만 국소 수정하고 전체 재저장(`Set-Content` 등)하지 않는다. 깨진 문자(`?꾩`, `癒` 등)가 보이면 편집을 멈추고 알린다.

행동 원칙(가정 명시, 단순함, 외과적 수정, 목표 기반 실행)은 `.claude/rules/behavior.md`. 항상 로드되며 이 파일과 함께 적용된다.

### "왜"를 남기는 규칙 (나중에 헷갈리지 않게)

- **큰 결정** (스택, 구조, 정책, 라이브러리 선택) → `docs/decisions.md`. 날짜, 결정, 이유, 대안, 재검토 조건.
- **코드 안의 이유** → 주석. "무엇을"이 아니라 "왜". 코드만 봐서는 이유를 알 수 없는 곳에만 쓴다.
  - 쓴다: `// 카카오는 이메일 동의를 안 하면 null로 줌. 그래서 nullable`
  - 안 쓴다: `// 사용자를 조회한다` (코드가 이미 말함)
  - 우회·임시 처리에는 반드시: `// TODO(이유): ... 언제 제거`
- **커밋의 이유** → 커밋 메시지 본문. 제목은 "무엇을", 본문은 "왜"와 "다른 방법 대신 이걸 고른 이유". 한 줄짜리 커밋은 사소한 변경만.
- **Claude가 틀렸던 것** → `docs/lessons.md`. 같은 실수가 두 번 나오면 여기 적고, 세 번이면 이 파일의 규칙으로 승격.
- 세션을 시작할 때 `lessons.md`를 읽는다. `decisions.md`는 구조·정책을 바꾸려 할 때 맨 위 색인부터 읽고, 거기 적힌 것과 반대로 하려면 먼저 이유를 말한다.

## Git

- 브랜치: `main`(배포 상태, 직접 푸시 금지) ← `feat/<기능>`, `fix/<버그>`, `db/<스키마변경>`, `docs/<문서>`, `chore/<잡무>`
- 예외 (2026-09-21, 1인 개발 동안): `docs/`, `CLAUDE.md`, `.claude/`, 코드 주석만 바꾸는 커밋은 main 직접. 실행 결과가 바뀌는 변경은 아무리 작아도 브랜치.
- 코드 브랜치는 **푸시 후 PR로 머지** (1인이라 셀프 머지). PR 본문이 그 기능의 설명서 — 무엇을·왜·확인 방법. 머지 후 브랜치 삭제. 브랜치 보호는 force push·삭제 금지 + CI 통과만 (PR 필수는 팀원 생기면).
- 스키마 변경은 `db/` 브랜치로 분리. 코드 변경과 섞지 않는다.
- 커밋: Conventional Commits + 범위. `feat(backend): 카카오 로그인 콜백`, `fix(frontend): 실시간 목록 중복 표시`, `db: listings에 seller_org_id 추가`
- 커밋은 작동하는 상태에서, 작게, 자주. 한 커밋에 한 가지.
- 머지 전: `./gradlew check` + `pnpm typecheck && pnpm lint && pnpm test` 통과, `/code-review` 실행. 스키마·인증·권한 변경은 `/security-review`도.
- 배포 시 태그 `vX.Y.Z`.
- `.env*`, `CLAUDE.local.md`는 `.gitignore`. 키가 한 번이라도 올라가면 재발급.

## 언어

- 코드 주석·커밋 메시지·문서: 한국어. 식별자(변수·함수·클래스·테이블): 영어.
- 사용자에게 보이는 문구는 `frontend/src/messages/`에 모아둔다. 컴포넌트에 하드코딩하지 않는다.
