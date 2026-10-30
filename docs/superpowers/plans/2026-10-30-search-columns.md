# 검색 결과 표 컬럼 재구성

## 설계

### 요구 (사용자 지시, 2026-10-30 대화)
검색 결과 표를 이 순서로 보인다: **상품명 · 제조사 · 단가 · 수량 · 상품상태 · 카테고리 · 최소 주문 수량 · 주문단위 · 납기일 · 등록일** (10개).
판매 상태 칸은 두지 않는다 — 기본 검색이 이미 거래 가능만 보여 준다. 상품명·제조사가 맨 앞.

### 현재
- 표(`ResultList.tsx` `columns`)는 상품명(고정) + 상품번호·제조사·제조일·상품상태·상품설명·데이터시트·사진·보증기한·불량지원·대체품·테스트리포트·정품인증서. **단가·수량·카테고리·납기일·등록일은 표에 없다** (모바일 카드에만 단가·재고).
- 같은 `ResultList` 를 검색 · 내 판매(`mine`) · 장바구니(`cart`) · 내 활동내역이 쓴다.
- 내 판매의 행 안 수정(`RowEditor`)은 표 열에 맞춰 상품명·번호·제조사·제조일·상태 칸이 놓인다.
- 검색 응답(`ListingSearchItemResponse`)에 최소 주문 수량·주문단위가 없다. 엔티티에는 있다(`Listing.minOrderQuantity`, `orderUnit`).

### 정할 것 (추천을 기본으로 두고 진행, 다르면 알려 달라)
1. **수량 = 재고(`stockQuantity`)**. 구매 가능한 양이고 모바일 카드도 이미 재고를 보인다.
2. **빠지는 열**(상품번호·제조일·상품설명·데이터시트·사진·보증기한·불량지원·대체품·테스트리포트·정품인증서)은 표에서 뺀다. 상세 화면에는 그대로 있다. 사진·데이터시트 유무만 상품명 칸 옆 작은 아이콘으로 남기는 안은 **하지 않는다**(요청 밖).
3. **적용 범위 = `ResultList` 를 쓰는 모든 화면** (검색 · 내 판매 · 장바구니 · 활동내역). 화면마다 열이 다르면 새 예외가 생기고, 같은 컴포넌트라 한 번에 바뀐다.
4. **내 판매 행 안 수정**: 표에서 사라진 열(번호·제조일)의 입력 칸은 `RowEditor` 의 아래 패널로 옮긴다(보증·자료 패널처럼). 표 위 입력 칸은 남은 열(상품명·제조사·단가·수량·상태·카테고리…) 중 지금 고칠 수 있는 것만 제자리에 둔다. **이 부분이 가장 크다 — 구현 전에 `RowEditor` 를 읽고 범위를 다시 확정한다.**
5. 좁은 칸에서는 뒤쪽 열부터 가린다(등록일 → 주문단위 → 최소 주문 수량 → 카테고리). 지금처럼 가로 스크롤은 유지하되 상품명 고정.

### 백엔드
- `ListingSearchItemResponse` 에 `minOrderQuantity`, `orderUnit` (둘 다 `Integer`, 엔티티 값) 추가. 생성 지점은 `ListingService` 한 곳(+`CartService` 가 쓰는 변환). 마이그레이션 없음.
- 등록일은 이미 `regDate`(yyyyMMddHHmmss) — 표에는 `YYYY-MM-DD` 로 보인다.
- 카테고리는 지금 `category` 코드뿐이라 표에 코드가 뜬다. **경로 이름("대 > 중 > 소")으로 보이려면 서버가 이름을 내려줘야 한다**: 검색 응답에 `categoryPath` 추가(상세와 같은 방식, 10-19 결정). 목록 20줄마다 3행 조회가 되므로 카테고리 마스터를 한 번에 읽어 맵으로 푼다 — 캐시 없음.

### 프론트
- `types/listing.ts` `ListingSearchItem` 에 `minOrderQuantity`, `orderUnit`, `categoryPath` (서버 DTO 와 1:1).
- `messages/search.ts` `columns` 에 단가·수량·카테고리·최소 주문 수량·주문단위·납기일·등록일 문구.
- `ResultList.tsx` `columns` 를 위 10개로 교체(상품명은 고정 칸 그대로, 제조사부터 `columns`). 단가는 `formatPrice()`, 날짜·숫자는 `num`.
- 모바일 카드는 이미 상품명·제조사·상태·재고·단가를 보인다 — 납기일·최소 주문·주문단위는 한 줄 더 추가하지 않는다(요청은 표). 필요하면 알려 달라.

### 영향
- API: 검색 응답에 필드 3개 추가(기존 클라이언트는 무시). 장바구니 응답이 같은 DTO 를 쓰면 같이 채운다.
- 보안: 개인정보 없음.
- 문서: 10-19 "검색 필터" 결정의 컬럼 순서(사용자가 정한 그대로)를 이번 결정으로 대체 → `decisions.md` 에 항목 추가, `design.md` 표 설명 갱신.

## 작업

1. [백엔드] `ListingSearchItemResponse` 3필드 추가 + `ListingService` 변환 + 카테고리 경로 일괄 해석. `ListingSearchApiTest` 에 최소 주문·주문단위·경로 검증 (TDD: 테스트 먼저).
2. [백엔드] 장바구니 변환(`CartService`) 확인 — 같은 DTO 면 같이 채운다. `bruno/listings/list.bru` 예시 응답 갱신.
3. [프론트] 타입·messages 추가, `columns` 교체, 모바일 카드 영향 확인.
4. [프론트] `RowEditor` 를 새 열 구성에 맞춘다(위 4번). `rowEdit.test.ts` 등 관련 테스트 갱신.
5. [프론트] 좁은 칸 숨김 규칙. 390px · 3분할 오른쪽 칸 폭에서 확인.
6. 테스트: `./gradlew test --tests "*ListingSearchApiTest" --tests "*CartApiTest"`, `pnpm typecheck && pnpm lint && pnpm test`. PR 직전 `./gradlew check` 1번, E2E 는 `flow.spec.ts`(검색·내 판매 행 수정이 걸림)만 1번.
7. `decisions.md` 항목 · `design.md` 갱신 → PR → `/code-review` 1회.
