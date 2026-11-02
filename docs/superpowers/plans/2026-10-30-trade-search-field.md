# 거래 검색 구분(전체·상품명·제조사) — 계획

## 설계

### 왜
사용자 지적(2026-10-30): 내 활동내역 판매 탭 검색창에만 [전체 ▾] 구분이 있고, 거래이력·활동내역 요청·구매 탭엔 없다.
판매 탭은 매물 검색(전체·상품명·제조사)을 쓰고, 거래 검색은 상품명만 찾기 때문이다.
사용자 결정: 거래 검색도 같은 세 구분을 지원해 모양·기능을 통일한다. [상세 필터]는 그대로 둔다 — 거래 줄은 조건이 적어 묶을 게 없다.

### 동작
- 거래이력(`GET /api/v1/trades/history`), 활동내역 요청·구매(`GET /api/v1/trades`)에 `field` 파라미터 추가: `all`(기본) | `name` | `brand`.
- 찾는 범위는 매물 검색(`ListingSearchRepository`)과 같다.
  - `name`: 상품명 + 상품번호
  - `brand`: 제조사
  - `all`: 상품명 + 상품번호 + 제조사
- 검색어는 공백으로 나눈 낱말이 전부 들어 있어야 맞는다(매물 검색과 같다). 지금은 검색어 전체를 한 덩어리로 찾는다 — 매물 검색과 맞춘다.
- 틀린 `field` 는 400 `fields.field`. 검색어가 없으면 `field` 는 무시.
- 맞는 상품 수 상한(500)은 그대로.
- 검색창 안내 글은 매물 검색과 같은 "모델명 · 상품번호 · 제조사".

### 다른 영역 영향
- API: 파라미터 추가만. 기존 요청(`field` 없음)은 `all` 로 동작 — 지금보다 넓게(상품번호·제조사도) 맞는다.
- DB: 변경 없음.
- 공통 부품 `DetailFilter`: 검색 구분 select 를 선택 항목으로 추가. 검색 화면(`FilterBar`)은 검색창이 따로 있어 영향 없음.

## 작업

1. 백엔드
   - `ProductRepository`(또는 커스텀 조회): 범위(field)와 낱말 목록으로 상품ID 찾기. 낱말 수가 바뀌므로 동적 JPQL(`ListingSearchRepository` 방식, 파라미터 바인딩, `lower()` 는 DB 쪽).
   - `ProductService.idsByName` → `idsMatching(field, q, limit)`, `ListingService.productIdsByName` 같은 이름으로 교체.
   - `TradeFilter` 에 `field`, `TradeFilterRules` 에서 검증.
   - `TradeController` 두 목록에 `field` 파라미터.
   - 테스트(`TradeActivityApiTest`): 제조사로 찾기, 상품번호로 찾기, `name` 이면 제조사로 안 맞음, 여러 낱말, 틀린 `field` 400.
   - `bruno/trades/history.bru`, `list.bru` 에 `field`.
2. 프론트
   - `DetailFilter`: `searchField?: { key, label, options }` 가 있으면 검색 상자 왼쪽에 `SearchForm` 과 같은 모양의 select.
   - `lib/historyFilter.ts`, `lib/tradeFilter.ts`: `field` 키(기본 `all`) — 주소 파싱(틀린 값은 `all`), API 파라미터(`all` 이면 안 보냄), 서버 오류 키 매핑.
   - 스키마(`lib/validation/historyFilter.ts`)에 `field` enum.
   - 문구: 구분 이름은 `messages/search.ts` `form.fields` 를 그대로 쓰고, 안내 글은 `search.form.placeholder` 와 같게.
   - 단위 테스트(historyFilter·tradeFilter) 갱신.
3. 문서: `docs/security.md` 입력 검증(거래 검색 `field`), `docs/decisions.md` 2026-10-30 항목 추가(구분 통일, 상세 필터는 그대로 둔 이유).
4. 확인: 바꾼 영역 테스트 → PR 직전 `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, E2E `purchase.spec.ts` 1번.
