# market

IT 장비·솔루션 마켓플레이스. 개인·사업자가 상품을 올리고 채팅으로 거래한다. (AI 기능 — 견적서 PDF로 등록 초안, 챗봇 조회 — 은 보류)

- 프론트: Next.js (Vercel)
- 백엔드: Spring Boot, Java 21 (자체 서버, Docker Compose)
- 데이터: PostgreSQL + pgvector, Redis (파일 저장소는 업로드 구현 시 결정)

전체 구조는 [docs/architecture.md](docs/architecture.md), 왜 그렇게 정했는지는 [docs/decisions.md](docs/decisions.md).

## 상태

계정(개인·기업 로그인, 개인·기업 가입, refresh/logout, 내 정보)을 구현했다. 소셜 로그인(카카오·네이버·구글)은 구현 후 일시 비활성(주석 처리). 상품·채팅은 아직 없다.

## 처음 받은 사람이 할 일

1. Java 21, Node.js + pnpm, Docker Desktop 설치
2. `.env.example`을 `.env`로 복사하고 값 채우기
3. 이 폴더에서 Claude Code 실행 (`claude`). `CLAUDE.md`와 `.claude/rules/`가 자동으로 로드된다

규칙과 문서 목록은 [CLAUDE.md](CLAUDE.md).

## 실행

```
docker compose up -d          # postgres, redis
cd backend && ./gradlew bootRun
cd frontend && pnpm dev
```
