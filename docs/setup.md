# 개발 환경 설치

> 새 PC에서 이 프로젝트를 시작할 때. Windows 11 기준, winget 사용. 다른 OS면 같은 도구를 각자 방식으로.

## 설치 순서

| 순서 | 도구 | 명령 | 확인 |
|---|---|---|---|
| 1 | Git | `winget install Git.Git` | `git --version` |
| 2 | Java 21 (Temurin) | `winget install EclipseAdoptium.Temurin.21.JDK` | `java -version` → 21.x |
| 3 | Node.js LTS | `winget install OpenJS.NodeJS.LTS` | `node -v` |
| 4 | pnpm | `corepack enable` (Node에 포함) | `pnpm -v` |
| 5 | Python 3.12 | `winget install Python.Python.3.12` (있으면 생략) | `python --version` |
| 6 | uv | `winget install astral-sh.uv` | `uv --version` |
| 7 | Docker Desktop | `winget install Docker.DockerDesktop` | 재부팅 후 `docker compose version` |
| 8 | Bruno (API 테스트) | `winget install Bruno.Bruno` 또는 https://www.usebruno.com/downloads | 실행 후 `bruno/` 폴더를 컬렉션으로 열기 |

- Gradle은 설치하지 않는다. `backend/gradlew`(wrapper)가 Java만 있으면 알아서 받는다.
- 설치 후 **새 터미널**을 열어야 PATH가 반영된다.
- Docker Desktop은 관리자 권한과 WSL2가 필요. 회사 PC는 정책 확인.

## 설치 후

```
git clone <저장소>
cd market
cp .env.example .env          # 값 채우기 (팀 공유 비밀 저장소에서)
docker compose up -d
```

각 서비스 실행은 `README.md`.

## Claude Code

- 이 폴더에서 `claude` 실행. `CLAUDE.md`, `.claude/rules/`, `docs/tasks.md`, `docs/lessons.md`가 자동 로드된다.
- 계정·PC가 바뀌어도 대화 기록은 넘어가지 않는다. **저장소의 문서가 기억이다.** 결정·진행 상황은 반드시 문서에 남긴다.
- 세션 시작 문장 예: `docs/tasks.md 보고 "다음"의 첫 항목부터 진행해줘`

## 도구 버전 (2026-09-18 확정)

| 도구 | 버전 | 고정 위치 |
|---|---|---|
| Java | 21 (Temurin 21.0.12) | `backend/build.gradle` toolchain |
| Spring Boot | 4.1.1 | `backend/build.gradle` |
| Gradle | wrapper (9.x) | `backend/gradle/wrapper/gradle-wrapper.properties` |
| Node | 24 LTS | `frontend/.nvmrc` |
| pnpm | 12.4 | `frontend/package.json` packageManager |
| Next.js | 16.3.5 | `frontend/package.json` |
| Python | 3.12 | `ai/.python-version` |
| uv | 0.12 | — |
| Postgres | 16 (pgvector) | `docker-compose.yml` |
| Redis | 7 | `docker-compose.yml` |

주의: winget이 이 PC에서는 크래시(1.2 구버전). 공식 설치 파일을 직접 받아 설치했음. 새 PC에서 winget이 되면 위 표대로.

## winget·관리자 권한 없이 설치 (2026-09-21 이 PC 방식)

관리자 권한 없이 사용자 폴더에 압축본을 풀고 사용자 PATH에 등록. 재설치·업그레이드는 폴더 교체.

| 도구 | 위치 | 방법 |
|---|---|---|
| JDK 21 | `%LOCALAPPDATA%\Programs\Temurin\jdk-21.x` | https://adoptium.net zip 압축 해제. `JAVA_HOME`(사용자)과 `bin`을 PATH에 |
| Node 24 | `%LOCALAPPDATA%\Programs\nodejs` | https://nodejs.org `win-x64.zip` 압축 해제, PATH에 |
| pnpm | Node 폴더 안 | `corepack enable` → `corepack prepare pnpm@12.4.2 --activate` |
| uv | `%USERPROFILE%\.local\bin` | `irm https://astral.sh/uv/install.ps1 \| iex` (PATH 자동 등록) |
| Gradle | `%USERPROFILE%\.gradle` | 없음. 첫 `gradlew` 실행 시 자동 다운로드 |

Git은 `C:\Program Files\Git`에 이미 설치되어 있었음(시스템 PATH). Docker는 관리자 권한 필요 → 별도.

### 소셜 로그인 콘솔 설정 (2026-09-22)
콜백은 브라우저가 아니라 **백엔드(8080)** 가 받는다. 경로는 `application.yml` 의 `redirect-uri` 와 정확히 같아야 한다.

| 제공자 | 항목 | 값 (로컬) |
|---|---|---|
| 네이버 | 서비스 URL / Callback URL | `http://localhost:3000` / `http://localhost:8080/api/v1/auth/oauth/naver/callback` |
| 카카오 | 앱 설정 > 플랫폼 > Web 도메인 | `http://localhost:3000`, `http://localhost:8080` |
| 카카오 | 제품 설정 > 카카오 로그인 > 활성화 ON, Redirect URI | `http://localhost:8080/api/v1/auth/oauth/kakao/callback` |
| 구글 | 승인된 JavaScript 원본 / 리디렉션 URI | `http://localhost:3000` / `http://localhost:8080/api/v1/auth/oauth/google/callback` |

- 동의 항목은 **이메일만 필수** (중복 가입 감지 기준, decisions.md 2026-09-22). 이름은 필수/추가 무관(닉네임 기본값으로만 씀). **휴대폰은 끈다** — 소셜 회원은 휴대폰을 저장하지 않으므로 수집 최소화.
- 카카오 이메일이 "선택 동의"(비즈 앱 전환 전)면 null 로 올 수 있다 → A3 에서 이메일 없으면 가입 불가 안내.
- 카카오 웹훅(연결 해제 알림)·로그아웃 리다이렉트·OIDC 는 기본값. 웹훅은 탈퇴 정리가 필요해질 때 `POST /api/v1/auth/oauth/kakao/unlink-webhook` 으로.
- 운영 배포 시 같은 자리에 `https://api.<도메인>/api/v1/auth/oauth/{provider}/callback` 을 **추가** (로컬 값은 유지).
- 키는 `.env` 의 `OAUTH_{KAKAO,NAVER,GOOGLE}_CLIENT_ID/SECRET`. 채팅·문서·커밋에 값을 넣지 않는다.

### Docker 없이 백엔드 테스트·실행 (2026-09-21, 임시)
Docker 도 Postgres 설치도 안 되는 PC 를 위해 테스트가 **내장 Postgres**(zonky, Gradle 이 바이너리를 받아 임시 폴더에서 실행)로 돈다. 설치할 것 없음.
- `./gradlew test` — Docker 가 없으면 자동으로 내장 Postgres. 첫 실행은 바이너리 다운로드로 1~2분.
- `./gradlew bootTestRun` — 같은 DB 로 앱 실행 (프론트 붙여서 확인할 때).
- Redis 도 같은 방식으로 내장 실행 (2026-09-22). 없는 것은 pgvector 만 — 상품 임베딩 테스트는 CI 에서만 검증된다.
- 왜·언제 걷어내나: `docs/decisions.md` "Docker 없는 PC".

