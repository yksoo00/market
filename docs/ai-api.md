# AI 서비스 계약 (Spring ↔ ai)

> 이 문서가 답하는 질문: Spring과 ai 서비스가 서로 어떤 요청·응답을 주고받는가. 챗봇이 호출할 수 있는 조회 함수는 무엇인가.
> 이 문서를 바꾸면 Spring과 ai 양쪽을 같은 PR에서 고친다.

## 공통 규칙

- ai는 docker 내부 네트워크에서만 접근. 주소 `http://ai:8000`. 외부 노출 없음.
- 모든 요청에 `X-Internal-Token` 헤더. 값은 양쪽 `.env`에 같은 값. 불일치 시 401.
- 모든 요청에 `X-Request-Id` 헤더 (Spring이 생성). 로그 추적용.
- 응답은 항상 `{ "ok": true, "data": ... }` 또는 `{ "ok": false, "code": "...", "message": "..." }`.
- 타임아웃: Spring 쪽에서 설정. `/parse-quote` 60초, `/chat` 30초, 나머지 5초. 초과 시 AI 기능만 실패, 서비스는 정상.
- ai는 사용자 인증을 모름. 권한이 필요한 조회는 Spring이 `user_id`를 넘기고 Spring 쪽 조회 API가 권한을 검사.
- 외부 API 키(OCR, LLM)는 ai의 `.env`에만.

---

## 1. `POST /parse-quote` — 견적서 → 품목 목록

### 요청
```json
{
  "file_url": "s3://quotes/2026/09/abc.pdf",     // MinIO 경로. ai가 직접 읽음
  "uploader_user_id": "uuid",
  "hint": "seller"                                 // "seller": 판매 등록용, "buyer": 구매 비교용. 미정 시 생략
}
```

### 처리
1. PDF에서 텍스트 추출 시도 (텍스트 PDF면 여기서 끝)
2. 추출 텍스트가 거의 없으면 스캔본으로 판단 → 외부 OCR API
3. LLM에 텍스트를 넘겨 아래 스키마로 구조화. 스키마에 없는 값은 `null`.
4. 품목이 0개면 `ok: false, code: "NO_ITEMS"`.

### 응답
```json
{
  "ok": true,
  "data": {
    "source": "text" | "ocr",
    "vendor": { "name": "㈜OO시스템", "contact": null },      // 견적서 발행처. 없으면 null
    "issued_at": "2026-09-01",                                // 없으면 null
    "currency": "KRW",
    "items": [
      {
        "line_no": 1,
        "name": "Dell PowerEdge R740",
        "manufacturer": "Dell",
        "model": "R740",
        "spec": "Xeon Silver 4210 x2, 64GB, 2TB SSD",         // 자유 텍스트. 구조화는 2단계
        "quantity": 2,
        "unit_price": 3500000,
        "total_price": 7000000,
        "condition": null,                                     // "new" | "used" | null
        "note": null,
        "confidence": 0.92                                      // LLM 자기 평가. 0.7 미만은 UI에서 강조
      }
    ],
    "raw_text_url": "s3://quotes/2026/09/abc.txt"              // 추출 원문. 사용자가 대조할 때
  }
}
```

### Spring 쪽 처리
- `items` 각각을 `listing_drafts` 행으로 저장. `confidence` 그대로 저장.
- 사용자에게 "초안 N건 생성됨" 알림. **자동 게시 없음.**
- 사용자가 초안 화면에서 수정·삭제·게시.

---

## 2. `POST /embed` — 상품 임베딩 생성

### 요청
```json
{ "product_id": "uuid", "text": "Dell PowerEdge R740 | Dell | R740 | Xeon Silver 4210 x2, 64GB | 중고" }
```
`text`는 Spring이 조립: `name | manufacturer | model | spec | condition`. 조립 규칙이 바뀌면 전체 재임베딩.

### 처리
Hugging Face 임베딩 모델(CPU, 다국어)로 벡터 생성 → `product_embeddings` 테이블에 upsert (`product_id`, `vector`, `model_version`).

### 응답
```json
{ "ok": true, "data": { "product_id": "uuid", "model_version": "bge-m3-v1" } }
```

- 호출 시점: 상품 생성·수정 시 Spring `@Async`. 실패해도 상품 저장은 정상.
- 모델을 바꾸면 `model_version`이 바뀌고, Spring이 전체 재임베딩 배치를 돌림.

---

## 3. `POST /similar` — 유사 상품

### 요청
```json
{ "product_id": "uuid", "limit": 10 }
```
또는 텍스트 기준:
```json
{ "text": "RTX 4090 24GB", "limit": 10 }
```

### 응답
```json
{ "ok": true, "data": { "product_ids": ["uuid", "uuid", ...], "scores": [0.91, 0.88, ...] } }
```

- ai는 **id만** 돌려줌. 상태(판매중/숨김)·권한 필터·상품 정보 조회는 Spring이 함.
- 자기 자신은 제외.

---

## 4. `POST /chat` — 챗봇 (LLM + 조회 함수)

### 요청
```json
{
  "user_id": "uuid",                       // 비로그인은 null. 조회 함수 권한의 기준
  "conversation_id": "uuid",
  "messages": [                            // 최근 N턴. 대화 저장은 Spring이 함
    { "role": "user", "content": "RTX 4090 중고 100만원 이하 있어?" }
  ]
}
```

### 처리
1. LLM에 시스템 프롬프트 + 아래 **조회 함수 목록**을 tool로 제공.
2. LLM이 함수 호출을 결정하면 ai가 Spring의 내부 조회 API(`http://api:8080/internal/tools/...`)를 호출. 이때 `user_id`를 그대로 전달 → Spring이 권한 검사.
3. 결과를 LLM에 돌려주고 최종 답변 생성. 함수 호출은 한 질문에 최대 5회.
4. 어떤 함수로도 답할 수 없으면 "그 정보는 아직 조회할 수 없습니다"로 답하고 `unanswered: true`.

### 응답
```json
{
  "ok": true,
  "data": {
    "answer": "3곳에서 판매 중입니다. 가장 저렴한 건 ...",
    "tool_calls": [ { "name": "search_products", "args": { ... } } ],   // 로그·디버깅용
    "referenced_product_ids": ["uuid", ...],                           // UI가 카드로 보여줄 것
    "unanswered": false
  }
}
```

- `unanswered: true`인 질문은 Spring이 별도 로그 테이블에 저장 → 다음 함수 후보.

---

## 5. 챗봇 조회 함수 (1단계 초안)

**규칙**
- 전부 읽기 전용. 쓰기 함수 없음 (등록·구매·채팅 전송은 챗봇이 못 함).
- 각 함수는 Spring `/internal/tools/{name}`로 구현. `user_id` 기준으로 권한 검사.
- 결과 행 수 상한 20. 개인정보(이메일·전화·계좌) 컬럼은 어떤 함수도 반환하지 않음.
- 함수를 추가할 때 이 표를 먼저 갱신하고 권한을 검토.

| 함수 | 인자 | 반환 | 권한 |
|---|---|---|---|
| `search_products` | keyword, category?, manufacturer?, condition?(new/used), min_price?, max_price?, sort?(price_asc/price_desc/newest), limit? | 상품 요약 목록 (id, 이름, 가격, 상태, 판매자명, 등록일) | 누구나. `status = active`만 |
| `get_product` | product_id | 상품 상세 (스펙 포함) | 누구나. active 또는 본인 것 |
| `similar_products` | product_id 또는 text, limit? | 상품 요약 목록 | 누구나 (내부에서 `/similar` 호출) |
| `get_seller_summary` | seller_id | 판매자 공개 정보 (표시명, 사업자 여부, 판매중 수, 거래완료 수, 가입일) | 누구나. 연락처 제외 |
| `list_categories` | — | 카테고리 트리 | 누구나 |
| `my_listings` | status? | 내 등록 상품 목록 | 로그인 본인만 |
| `my_drafts` | — | 내 견적서 초안 목록 (건수, 상태) | 로그인 본인만 |
| `my_chats_summary` | — | 내 채팅방 목록 (상대 표시명, 상품, 마지막 메시지 시각, 안 읽은 수). **본문 없음** | 로그인 본인만 |
| `price_stats` | keyword 또는 model | 해당 상품의 현재 판매가 최소/중앙/최대, 건수 | 누구나. 집계만 |

**의도적으로 없는 것**
- 채팅 본문 조회 (본인 것이어도). 챗봇에 대화 내용을 넘기지 않음.
- 다른 사용자의 비공개 정보.
- 사업자 정산·거래 금액 상세 (3단계에서 owner 권한으로 별도 검토).
- 관리자 기능.

**2단계 확장 예정**
- `search_products`를 구조화 필터(JSON → 코드가 SQL 생성, 허용 컬럼 검증)로 확장 → 임의 조합 필터·정렬·집계.
- `unanswered` 로그 상위 항목을 함수로 추가.

---

## 6. 헬스체크

`GET /health` → `{ "ok": true, "model_loaded": true, "llm_reachable": true }`
Spring은 이걸로 AI 기능 표시 여부를 결정. `llm_reachable: false`면 챗봇·견적 파싱 버튼을 비활성.

---

## 미정
- `hint` (seller/buyer) — 견적서를 누가 올리는지 기능 정리 후
- 임베딩 모델 선택 (한국어 성능 기준으로 2~3개 비교 후)
- 조회 함수 최종 목록 — "챗봇에 물어볼 질문 5개" 받은 뒤 조정
