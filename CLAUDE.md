# market

IT 장비·솔루션 마켓플레이스. Spring Boot 4.1 (Java 21) + Next.js 16, PostgreSQL 16 + pgvector, Redis 7.
AI 기능(견적서 파싱·추천·챗봇)은 보류 — `ai/` 서비스는 제거했고 재개 시 다시 만든다 (decisions.md 2026-09-29).

## 문서

자동 로드: 이 파일, `.claude/rules/{backend,frontend,db}.md`(해당 경로 작업 시). 규칙은 한 곳에만 둔다 — 같은 규칙을 메모리·lessons 에 또 쓰지 않는다.

`docs/`는 자동 로드되지 않는다. 아래 "언제"에 해당하는 작업이면 **코드를 바꾸기 전에** 그 문서를 읽거나 `@`로 붙인다 (한 번에 1~3개, 사소한 수정엔 안 붙임). `lessons.md`만 세션 시작 때 읽는다.

| 문서 | 답하는 질문 | 언제 |
|---|---|---|
| `docs/architecture.md` | 뭐가 어디서 돌고 어떻게 연결되나 | 배포·compose·인프라를 건드리거나 전체 흐름을 파악할 때 |
| `docs/decisions.md` | 왜 그렇게 정했나. 맨 위에 현재 유효한 결정 색인 → 미정. 완전히 대체된 옛 결정은 `decisions-archive.md` | 구조·정책·화면 구성의 큰 흐름을 바꾸기 전(색인부터). **결정을 뒤집기 전에 반드시**. 큰 결정을 내리면 여기에 추가 |
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
docker compose up --watch api-dev    # 백엔드를 컨테이너로 (+ postgres, redis). 소스 저장 → 10초 안팎 자동 재시작. 호스트 bootRun 과 8080 겹침

# backend/
./gradlew bootRun                    # 실행
./gradlew test                       # 테스트. Docker Desktop 실행 필수 (Testcontainers Postgres·Redis)
./gradlew test --tests "*CartApiTest" # 작업 중엔 바꾼 영역만 (전체는 3~5분)
./gradlew check                      # 컴파일 + 테스트 + 정적 분석. PR 올리기 직전 1번 통과 필수

# frontend/
pnpm dev / pnpm build
pnpm typecheck / pnpm lint          # typecheck는 next typegen 포함
pnpm test                           # Vitest (lib·hook 단위. *.test.ts)
pnpm e2e                            # Playwright 핵심 흐름 (e2e/*.spec.ts). 백엔드·compose 먼저 실행
```

## 저장소 구조

```
market/
├── CLAUDE.md, README.md, docker-compose.yml, .env.example
├── .claude/rules/       ← 경로별 세부 규칙 (backend, frontend, db)
├── docs/                ← 위 문서. docs/superpowers/ 는 기능별 설계·계획 기록
├── backend/             ← Spring Boot. 도메인별 패키지 user, listing, trade, common (organization 은 테이블 없이 남은 코드)
├── frontend/            ← Next.js. 홈·로그인·가입·매물 등록/검색/상세·마이페이지·구매 화면
├── bruno/               ← API 요청 모음 (Bruno). 새 API 추가 시 같은 PR에서 요청 파일도
├── infra/               ← 보류된 Caddyfile
└── .github/workflows/   ← CI
```

## 핵심 규칙 (항상)

### 아키텍처

- 모듈러 모놀리스. Spring 하나. **서비스를 더 쪼개지 않는다.** MSA 아님. (AI 재개 시 FastAPI 1개만 예외)
- 백엔드는 stateless. 세션·임시 데이터를 프로세스 메모리에 두지 않는다 → Redis, Postgres. 업로드 파일은 서버 로컬 디스크(`common/storage`, decisions.md 2026-10-02).
- 조회 캐시를 임의로 추가하지 않는다. 느린 것이 측정되면 상의 후 `common/cache` 경유.
- 라이브러리·의존성을 추가하기 전에 **먼저 물어본다.** 프레임워크 기본 기능으로 되는지 확인.

### 데이터

- 스키마 변경은 항상 Flyway 마이그레이션 파일. 콘솔·JPA ddl-auto로 바꾸지 않는다.
- 마이그레이션은 직전 배포 버전과 호환 (무중단). 컬럼 이름 변경·삭제는 배포 2회로 나눈다.
- 테이블·컬럼은 사용자가 준 정의서 물리명(`trd_*`) 그대로. 새 테이블 이름, 정의서와 다른 길이·제약·인덱스는 내가 정하지 않고 차이를 보여 주고 묻는다.
- 권한(역할)은 지금 없음 — 관리자 기능이 필요해지면 정의서와 함께 다시 정한다 (decisions.md 2026-10-13).
- 이미지·파일은 경로 저장

### 보안

- 입력 검증은 **두 층 전부**: 프론트(zod, 입력 즉시 피드백) → 백엔드(Bean Validation, 같은 규칙). 어느 층도 다른 층을 믿고 생략하지 않는다. 규칙 수치는 `docs/security.md` "입력 검증"이 원본이고 프론트·백엔드가 같은 값을 쓴다.
- 프론트는 검증 결과에 반드시 반응한다: 필드 옆 오류 문구, 제출 버튼 비활성/활성, 서버가 돌려준 필드 오류를 해당 필드에 표시. 오류를 조용히 삼키지 않는다.
- 클라이언트가 보낸 `userId`를 신뢰하지 않는다.
- 비밀값은 `.env`에만. 코드·로그·커밋에 절대 넣지 않는다. `.env.example`에는 키 이름만.
- 개인정보(이메일·전화·계좌)는 API 응답·로그에 노출하지 않는다.
- 저장소는 공개다. 사용자가 대화에서 알려 준 실제 IP·포트·호스트는 예시로도 파일·커밋·PR 에 쓰지 않는다 (`<VM 주소>` 같은 자리 표시만). 올리기 전 `git grep` 으로 확인.

### 작업 방식

- 스킬 쓰는 기준 (superpowers 의 "항상 먼저 스킬"보다 이 줄이 우선):
  - 파일 3개 이상, 또는 DB·인증·권한·화면 흐름이 바뀌면 예외 없이 `superpowers:brainstorming` → `writing-plans` → 승인 후 구현. 구현은 가능하면 `test-driven-development`.
  - 단, 중간 크기 기능(새 테이블·새 도메인 패키지·인증/권한 변경이 **없는** 기능 — 예: 장바구니·비교용)은 스펙과 계획을 `docs/superpowers/plans/` 파일 **하나**로 쓴다(맨 위 "설계" 절 + 아래 작업). 승인은 그 파일 한 번. 구현은 직접(native), 작업마다 리뷰하지 않고 PR 의 `/code-review` 한 번 (2026-10-21, decisions.md).
  - 테스트 실행: 작업 중엔 바꾼 영역 테스트만(`--tests`, `pnpm exec vitest run <파일>`, 프론트 typecheck·lint 는 항상 같이). 백엔드 전체 `./gradlew check` 는 PR 직전 1번. E2E 는 PR 직전에 그 기능 spec 만 1번 — 단계 실패만 조사하고, 시간 초과는 재실행 1번 통과면 끝(원인 조사 안 함).
  - 버그·이상 동작은 `systematic-debugging` 먼저. 완료·PR 전 `verification-before-completion`.
  - 코드·문서를 본 뒤에도 요구가 안 정해진 큰 항목은 `grilling`(사용자용 `grill-me`와 같은 내용)으로 WHAT/WHY 를 정하고 멈춘다.
  - 질문·상태 확인·작은 수정엔 스킬을 부르지 않는다. 승인된 계획 뒤에 다시 부르지 않는다.
- 질문(~냐, ~까, ~아니야?)엔 의견·근거·대안만 답하고 멈춘다. 하라고 할 때만 코드를 바꾼다.
- 큰 작업은 먼저 계획을 보여주고 승인 후 구현한다. 한 번에 한 기능.
- 가정은 말하고, 해석이 여럿이면 고르지 말고 보여 준다. 요청 밖 기능·추상화·설정 항목을 만들지 않는다.
- 바꾼 줄은 전부 요청에 이어져야 한다. 옆 코드 개선·리팩터 금지. 내 변경이 만든 미사용만 지우고, 원래 있던 죽은 코드는 말만 한다.
- 현재 동작은 코드·테스트가 기준. 문서와 다르면 코드를 따르되, 정책 의도가 불명확하면 묻는다. 관련 기능의 기존 구현·호출 흐름·패턴을 먼저 확인하고 따른다.
- 코드·문서·테스트로 판단되는 건 묻지 않고, 이미 결정된 건 다시 묻지 않는다. 그 외 모르는 것은 추측하지 말고 묻는다.
- 코드를 바꾸면 해당 테스트를 같이 바꾼다. 테스트 없이 "동작할 것"이라고 말하지 않는다.
- 결과 보고에는 구현 선택 이유와 다른 영역(API·데이터 흐름·UI·공통 모듈) 영향 검토를 포함한다.
- 결정을 바꾸면 `docs/decisions.md`에 이유를 추가한다. 기존 항목은 지우지 않고 아래에 덧붙인다.
- `git checkout -- <path>`, `git restore`, `git reset --hard` 등 미커밋 변경을 버리는 명령은 사용자 명시 요청 없이 쓰지 않는다. 복구가 필요하면 직접 수정한다.
- 인코딩: UTF-8(BOM 없음). 한글 파일은 필요한 줄만 국소 수정하고 전체 재저장(`Set-Content` 등)하지 않는다. 깨진 문자(`?꾩`, `癒` 등)가 보이면 편집을 멈추고 알린다.

### "왜"를 남기는 곳

- 큰 결정(스택·구조·정책·라이브러리) → `docs/decisions.md`. 색인과 반대로 하려면 먼저 이유를 말한다.
- 코드 안의 이유 → 주석. "무엇을"이 아니라 "왜", 코드만 봐선 모를 곳에만. 우회·임시 처리엔 반드시 `// TODO(이유): ... 언제 제거`.
- 커밋 → 제목은 "무엇을", 본문은 "왜"와 다른 방법 대신 이걸 고른 이유.
- Claude가 틀린 것 → 두 번째면 `docs/lessons.md`, 세 번째면 이 파일·rules 의 규칙으로 승격.

## Git

- 브랜치: `main`(배포 상태, 직접 푸시 금지) ← `feat/<기능>`, `fix/<버그>`, `db/<스키마변경>`, `docs/<문서>`, `chore/<잡무>`
- 예외 (2026-09-21, 1인 개발 동안): `docs/`, `CLAUDE.md`, `.claude/`, 코드 주석만 바꾸는 커밋은 main 직접. 실행 결과가 바뀌는 변경은 아무리 작아도 브랜치.
- 코드 브랜치는 **푸시 후 PR 까지만**. 머지는 사용자가 GitHub 웹에서 한다 — 로컬 머지·main 푸시 금지, 한 줄 수정도. PR 본문이 그 기능의 설명서 — 무엇을·왜·확인 방법. 머지 후 브랜치 삭제. 브랜치 보호는 force push·삭제 금지 + CI 통과만 (PR 필수는 팀원 생기면).
- 스키마 변경은 `db/` 브랜치로 분리. 코드 변경과 섞지 않는다.
- 커밋: Conventional Commits + 범위. `feat(backend): 카카오 로그인 콜백`, `fix(frontend): 실시간 목록 중복 표시`, `db: 거래 테이블 추가`
- 커밋은 작동하는 상태에서, 작게, 자주. 한 커밋에 한 가지.
- 머지 전: `./gradlew check` + `pnpm typecheck && pnpm lint && pnpm test` 통과.
- PR 을 열면 내가 직접 `/code-review`(PR 당 1회, 이후엔 새 커밋 범위만) → 타당한 지적 반영 → 검사 다시 → 보고. Minor 도 내가 고침/보류+이유로 정하고, 사용자에게 고르라고 넘기지 않는다.
- `/security-review` 는 diff 에 마이그레이션·인증(로그인·토큰·세션)·권한 검사 변경이 있을 때만.
- 배포 시 태그 `vX.Y.Z`.
- `.env*`, `CLAUDE.local.md`는 `.gitignore`. 키가 한 번이라도 올라가면 재발급.

## 언어

- 코드 주석·커밋 메시지·문서: 한국어. 식별자(변수·함수·클래스·테이블): 영어.
- 사용자에게 보이는 문구는 `frontend/src/messages/`에 모아둔다. 컴포넌트에 하드코딩하지 않는다.
