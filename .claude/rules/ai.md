---
paths:
  - "ai/**"
---

# AI 서비스 (FastAPI, Python 3.12)

## 구조
```
ai/app/
├── main.py         라우터 등록, 헬스체크, 내부 토큰 미들웨어
├── quote.py        견적서 파싱 (텍스트 추출 → OCR fallback → LLM 구조화)
├── embed.py        임베딩 생성·유사 검색 (pgvector)
├── chat.py         tool calling 챗봇
├── llm.py          외부 LLM 클라이언트. 제공자 교체 가능하게 인터페이스 뒤에
├── schemas.py      요청·응답 pydantic 모델. docs/ai-api.md와 1:1
└── config.py       환경변수
```

## 컨벤션
- 계약은 `@docs/ai-api.md`가 원본. 응답 형태를 바꾸면 그 문서와 Spring 쪽을 같은 PR에서.
- 모든 요청·응답은 pydantic 모델. dict 직접 반환 금지.
- 타입 힌트 필수, `mypy` 통과. `ruff` 포맷.
- 이 서비스는 **인증·권한·도메인 로직을 갖지 않는다.** `user_id`는 Spring에 그대로 전달만.
- DB 접근은 `product_embeddings` 테이블만. 다른 테이블 조회·수정 금지.
- 외부 API 키는 `.env`. 코드·로그에 노출 금지.
- 외부 호출(OCR, LLM)에는 타임아웃·재시도 1회. 실패는 `{ ok: false, code }`로. 예외를 밖으로 던지지 않는다.
- LLM 프롬프트는 `prompts/` 디렉터리의 파일로. 코드 문자열에 박지 않는다.

## 챗봇
- 조회 함수 목록은 `docs/ai-api.md` 5절이 전부. 거기 없는 함수를 만들지 않는다.
- LLM이 SQL·코드를 생성해 실행하는 경로를 만들지 않는다.
- 함수 호출은 한 질문에 최대 5회. 초과 시 "답할 수 없습니다".
- `unanswered` 판단 기준: 어떤 함수도 호출 못 했거나, 결과가 비어 있어 답을 지어내야 하는 경우.

## 견적서 파싱
- 텍스트 추출 먼저(pdfplumber). 추출 문자 수가 임계값 미만이면 OCR.
- LLM 구조화 결과는 스키마로 검증. 검증 실패 시 한 번 재시도, 그래도 실패면 `NO_ITEMS`.
- `confidence`는 LLM에 항목별로 요구. 없으면 0.5.

## 테스트
- pytest. 외부 API는 mock. 견적서 샘플은 `ai/tests/fixtures/`.
- 파싱 테스트는 샘플별 기대 품목 수·첫 품목 값 검증.
