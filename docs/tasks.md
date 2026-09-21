# 진행 상황

> 세션 시작 시 자동 로드. 작업이 끝나면 여기를 갱신한다. 짧게 유지 (완료 항목은 20개 넘으면 아래로 접는다).
> 계정·PC가 바뀌어도 이 파일이 이어주는 유일한 끈이다. 대화에서 정한 것은 여기나 `decisions.md`에 반드시 적는다.

## 지금 하는 것
- [ ] Docker Desktop 설치 (사용자 직접) → 설치 후 `docker compose up -d` 와 `./gradlew test` 확인
- [ ] GitHub `yksoo00/market` main 브랜치 보호 (force push·삭제 금지. CI 생기면 상태 체크 필수) — 웹에서 직접
- [ ] `gh` CLI 설치 (PR 생성용, `winget install GitHub.cli` 또는 https://cli.github.com) — 없으면 PR 은 웹에서

## 다음
- [ ] 인증 UI (백엔드 없이, `lib/api` 실제 호출 → 연결 실패 화면) — 3개 브랜치
  - [x] 2026-09-21 `feat/login` 로그인(일반⇄기업)·아이디 찾기·비밀번호 찾기·재설정 링크 페이지
  - [x] 2026-09-21 `feat/signup-personal` 선택 → 본인인증(UI) → 약관 → 정보입력(중복확인·이메일/휴대폰 분할) → 완료
  - [ ] `feat/signup-business` 약관 → 사업자 인증 → 정보입력 → 완료
  - [x] 2026-09-21 소셜 첫 로그인 `/signup/social` (약관+닉네임). 백엔드 계약: 콜백이 신규면 `?provider&token&nickname&next` 로 리다이렉트, `POST /auth/oauth/complete`
- [ ] `docs/data-model.md` — users 부분 먼저
- [ ] 인증 구현 (가입 → 로그인 → refresh → 로그아웃 → 내 정보) + 배포 한 번
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
- [ ] `bruno/` 컬렉션 초기화 (environments/local.bru, 첫 요청은 인증 구현 때) — Bruno 앱 설치 후
- [ ] 코드 포맷터·정적 분석 도구 확정 (Spotless/Checkstyle, Prettier/ESLint 설정, ruff 설정)
- [ ] PR 템플릿 (`.github/PULL_REQUEST_TEMPLATE.md`)
- [ ] 모니터링·알림 (Sentry, 업타임) — 배포 후
- [ ] Vitest 설정 (`frontend/`) — 첫 hook/lib 코드 생길 때
- [ ] GitHub Actions CI (`.github/workflows/ci.yml`: gradlew check, pnpm typecheck+lint, uv pytest) — 푸시 직후
- [ ] 배포 스크립트 (`infra/deploy.sh`: 빌드 → 마이그레이션 → api-1/2 순차 교체 → 롤백) — 서버 준비되면

## 나중
- [ ] 기업 계정 담당자 변경 절차 (1단계는 고객센터 수동) — 백엔드 인증 때
- [ ] 기업 가입 심사: `pending/approved/rejected` 상태, 관리자 심사 화면, 결과 이메일, 사업자번호 선점 이의 신청 — 백엔드 인증·관리자 때
- [ ] 본인인증 업체(PASS/NICE) 계약, Turnstile 키 발급, 국세청 진위확인 API 키 — 백엔드 인증 때
- [ ] 약관·개인정보처리방침 법무 검토 — 오픈 전
- [ ] HTML 준비 가이드(`C:\marketplace-guide\marketplace-guide.html`)가 Supabase 기준이라 낡음. 문서 세트 완성 후 갱신하거나 폐기
- [ ] staging 환경 — 첫 유저 후
- [ ] Cloudflare Pro — 이미지 트래픽 부담 시

## 완료
- [x] 2026-09-18 `docs/security.md` (기능 무관 부분)
- [x] 2026-09-18 개발 도구 설치 (Git, JDK 21, Node 24, pnpm, uv). Docker 제외
- [x] 2026-09-21 이 PC에 도구 재설치 (관리자 권한 없이 사용자 폴더, `docs/setup.md` 참조). 프론트 typecheck·lint, ai pytest·ruff·mypy, 백엔드 컴파일 통과. Docker 제외
- [x] 2026-09-18 뼈대: `backend/`(Boot 4.1.1), `frontend/`(Next 16.3), `ai/`(FastAPI), `docker-compose.yml`, `infra/Caddyfile`, Dockerfile ×2. 컴파일·lint·테스트 통과
- [x] 2026-09-17 `docs/architecture.md`, `docs/decisions.md`
- [x] 2026-09-18 `docs/ai-api.md`
- [x] 2026-09-18 `CLAUDE.md`, `.claude/rules/` 5개 (behavior는 Karpathy 원문)
- [x] 2026-09-18 `docs/lessons.md`, `docs/tasks.md`, `docs/setup.md`, `docs/README.md`, `README.md`
