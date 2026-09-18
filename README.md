# market

IT 장비·솔루션 마켓플레이스. 개인·사업자가 상품을 올리고 채팅으로 거래한다. 견적서 PDF를 읽어 상품 등록 초안을 만들고, 챗봇으로 상품을 조회한다.

- 프론트: Next.js (Vercel)
- 백엔드: Spring Boot, Java 21 (자체 서버, Docker Compose)
- AI: FastAPI (OCR·임베딩·챗봇, 내부 전용)
- 데이터: PostgreSQL + pgvector, Redis, MinIO

전체 구조는 [docs/architecture.md](docs/architecture.md), 왜 그렇게 정했는지는 [docs/decisions.md](docs/decisions.md).

## 상태

문서 작성 단계. 코드 없음. 다음 할 일은 [docs/tasks.md](docs/tasks.md).

## 처음 받은 사람이 할 일

1. [docs/setup.md](docs/setup.md)대로 도구 설치
2. 이 폴더에서 Claude Code 실행 (`claude`). `CLAUDE.md`와 규칙이 자동으로 로드된다
3. "`docs/tasks.md` 보고 다음 항목 진행해줘"라고 시작

이 프로젝트는 AI 코딩 도구(Claude Code)와 함께 개발한다. 사람이 읽는 규칙은 [CLAUDE.md](CLAUDE.md), 문서 사용법은 [docs/README.md](docs/README.md).

## 실행 (뼈대 생성 후 갱신 예정)

```
docker compose up -d          # postgres, redis, minio, caddy
cd backend && ./gradlew bootRun
cd frontend && pnpm dev
cd ai && uv run uvicorn app.main:app --reload
```
