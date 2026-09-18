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
