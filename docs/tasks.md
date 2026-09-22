# 진행 상황

> 세션 시작 시 자동 로드. 작업이 끝나면 여기를 갱신한다. 짧게 유지 (완료 항목은 20개 넘으면 아래로 접는다).
> 계정·PC가 바뀌어도 이 파일이 이어주는 유일한 끈이다. 대화에서 정한 것은 여기나 `decisions.md`에 반드시 적는다.

## 지금 하는 것
- [ ] Docker Desktop 설치 — 교육용 PC 라 당분간 불가. 그동안 테스트는 내장 Postgres·Redis (decisions.md 2026-09-21). Docker 가 되면 zonky·embedded-redis 제거
- [x] 2026-09-21 `TestInfraConfiguration`: Docker 없으면 zonky 내장 Postgres 16 (PR #7), 2026-09-22 embedded-redis 추가
- [x] 2026-09-22 인증 A1 (`feat/auth-core`): Security 설정·JWT 쿠키·Origin 검사·전역 예외, 로그인(일반·기업)·refresh 회전·로그아웃·`/users/me`·관리자 시드·잠금. API 테스트 19개, `bruno/auth`·`bruno/users` (PR 예정)
- [ ] `chore/logging` (A2 전): requestId MDC 필터, Boot 내장 구조화 로그(`logging.structured.format.console`), 보안 이벤트 WARN(로그인 실패·잠금·refresh 재사용 감지 — userId·IP 만, 아이디·이메일 금지)
- [ ] 인증 A2 일반 가입 (본인인증 stub → 약관 → 정보, 중복확인) → A3 소셜 → A4 기업 → A5 찾기
  - A2 첫 커밋: `common/exception/ErrorCode` enum 으로 코드 모으기 — 기능별(Login/Signup) 분리 **안 함**, 문제 기준 하나의 enum 에 주석으로 묶음. 코드 이름 = 프론트 `messages/*.ts` errors 키 (2026-09-22 결정)
  - A3: 카카오 이메일 null(선택 동의) → 가입 불가 안내. 제공자 이메일이 이미 있으면 "OO 로 가입된 계정" 안내
  - 나중: `mustChangePassword` 는 관리자 API(`/api/v1/admin/**`)에서 강제. pending 기업은 로그인 허용, 사업자 기능(배지·사업자 명의 매물)만 `common/auth/Permission` 에서 차단
- [ ] 프론트 `lib/api/client.ts`: 401 이면 `/auth/refresh` 한 번 시도 후 재요청 (A1 머지 후)
- [x] 2026-09-21 `gh` CLI 설치·로그인. 이제 PR 생성·머지·CI 확인은 Claude 가 `gh` 로 함

## 다음
- [x] 2026-09-21 인증 UI 전부 (PR #1 일반가입, #2 소셜, #4 기업가입; 로그인·찾기는 feat/login)
  - [x] 2026-09-21 `feat/login` 로그인(일반⇄기업)·아이디 찾기·비밀번호 찾기·재설정 링크 페이지
  - [x] 2026-09-21 `feat/signup-personal` 선택 → 본인인증(UI) → 약관 → 정보입력(중복확인·이메일/휴대폰 분할) → 완료
  - [ ] `feat/signup-business` 약관 → 사업자 인증 → 정보입력 → 완료
  - [x] 2026-09-21 소셜 첫 로그인 `/signup/social` (약관+닉네임). 백엔드 계약: 콜백이 신규면 `?provider&token&nickname&next` 로 리다이렉트, `POST /auth/oauth/complete`
- [x] 2026-09-21 `docs/data-model.md` 1절 계정 (users·social_accounts·identity_verifications·terms_agreements·organizations·organization_members, Redis 키)
- [x] 2026-09-21 `db/users`: 6개 테이블 Flyway + JPA 엔티티 + PiiConverter + `validate` 통과, 테스트 9개 (PR #8)
- [ ] 인증 구현 (가입 → 로그인 → refresh → 로그아웃 → 내 정보) + 배포 한 번
  - [ ] 소셜 첫 로그인: 제공자 이메일이 이미 있으면 가입 대신 "OO 로 가입된 계정" 안내 (decisions.md 2026-09-22). 프론트 `/signup/social` 오류 케이스 추가
- [ ] 기능 정리 받기 → `prd.md` → `data-model.md` 나머지 → `roles.md` → `security.md`
- [ ] 챗봇 예시 질문 5개 받기 → `ai-api.md` 5절 조정
- [ ] 견적서 샘플 2~3개 → `ai/tests/fixtures/`
- [ ] 참고 사이트 2~3개 + 색 → `design.md`

## 확인 필요 (Claude가 임의로 정한 것. 회사 관례와 다르면 바꿀 것)
- [ ] 빌드 도구 Gradle (Maven 아님)
- [ ] Python 패키지 관리 uv
- [ ] Java 패키지 루트 `com.company.market` → 회사 도메인으로 교체
- [ ] Lombok 제한 (`@Data`, `@Setter` 금지)
- [ ] 커서 페이지네이션만 (offset 금지) — 관리자 화면에선 완화 가능
- [ ] 주석·커밋 한국어, 식별자 영어

## 보강 필요 (실무 표준인데 아직 없는 것)
- [ ] API 문서화 (Springdoc/Swagger) 규칙 → `rules/backend.md`. 운영에서는 비활성
- [ ] ArchUnit: controller→service→repository, 도메인 간 repository 직접 접근 금지를 테스트로 강제 — 백엔드 첫 도메인 만들 때
- [ ] Definition of Done 한 절을 CLAUDE.md 에: `gradlew check`/typecheck·lint/pytest + `/code-review` + PR CI 초록 + docs 갱신 — 백엔드 시작 전
- [ ] pre-commit hook (lint·포맷 자동) — 포맷터 확정과 같이
- [ ] `bruno/` 컬렉션 초기화 (environments/local.bru, 첫 요청은 인증 구현 때) — Bruno 앱 설치 후
- [ ] 코드 포맷터·정적 분석 도구 확정 (Spotless/Checkstyle, Prettier/ESLint 설정, ruff 설정)
- [ ] PR 템플릿 (`.github/PULL_REQUEST_TEMPLATE.md`)
- [ ] 모니터링·알림 (Sentry, 업타임) — 배포 후
- [ ] Vitest 설정 (`frontend/`) — 첫 hook/lib 코드 생길 때
- [ ] 배포 스크립트 (`infra/deploy.sh`: 빌드 → 마이그레이션 → api-1/2 순차 교체 → 롤백) — 서버 준비되면

## 나중
- [ ] GitHub main 브랜치 보호 — 비공개 저장소는 Pro/Team 플랜 필요(API 403). 회사 조직 계정으로 옮기거나 팀원 생기면. 그전까진 CLAUDE.md 규칙으로
- [ ] 기업 계정 담당자 변경 절차 (1단계는 고객센터 수동) — 백엔드 인증 때
- [ ] 기업 가입 심사: `pending/approved/rejected` 상태, 관리자 심사 화면, 결과 이메일, 사업자번호 선점 이의 신청 — 백엔드 인증·관리자 때
- [ ] 본인인증 업체(PASS/NICE) 계약, Turnstile 키 발급, 국세청 진위확인 API 키 — 백엔드 인증 때
- [ ] 약관·개인정보처리방침 법무 검토 — 오픈 전
- [ ] HTML 준비 가이드(`C:\marketplace-guide\marketplace-guide.html`)가 Supabase 기준이라 낡음. 문서 세트 완성 후 갱신하거나 폐기
- [ ] staging 환경 — 첫 유저 후
- [ ] Cloudflare Pro — 이미지 트래픽 부담 시

## 완료
- [x] 2026-09-21 GitHub Actions CI (PR #3, #5 gradlew 권한, #6 concurrency). 세 job 초록 확인
- [x] 2026-09-18 `docs/security.md` (기능 무관 부분)
- [x] 2026-09-18 개발 도구 설치 (Git, JDK 21, Node 24, pnpm, uv). Docker 제외
- [x] 2026-09-21 이 PC에 도구 재설치 (관리자 권한 없이 사용자 폴더, `docs/setup.md` 참조). 프론트 typecheck·lint, ai pytest·ruff·mypy, 백엔드 컴파일 통과. Docker 제외
- [x] 2026-09-18 뼈대: `backend/`(Boot 4.1.1), `frontend/`(Next 16.3), `ai/`(FastAPI), `docker-compose.yml`, `infra/Caddyfile`, Dockerfile ×2. 컴파일·lint·테스트 통과
- [x] 2026-09-17 `docs/architecture.md`, `docs/decisions.md`
- [x] 2026-09-18 `docs/ai-api.md`
- [x] 2026-09-18 `CLAUDE.md`, `.claude/rules/` 5개 (behavior는 Karpathy 원문)
- [x] 2026-09-18 `docs/lessons.md`, `docs/tasks.md`, `docs/setup.md`, `docs/README.md`, `README.md`
