# 장바구니 카드 목록 (2026-11-03)

## 설계

사용자 지시(2026-11-03 대화): 장바구니를 표(검색 결과 표 재사용, 열 16개 안팎)에서 **쿠팡처럼 카드 목록**으로. 첨부 참고 화면: 위에 전체 선택·[장바구니 비우기], 카드마다 사진 · 품명(파란 링크) · 사양 · 재고/납기 · 수량 · 금액 · 삭제 아이콘. 결정(사용자 선택): **단순 카드 목록**(판매자별 묶음·별도 요약 칸 없음).

### 화면
- `CartView` 가 표(`ResultList scope="cart"`) 대신 새 `CartCardList` 를 쓴다. 불러오기·1분 재읽기·`onCartChanged` 구독은 그대로.
- 위 줄: 전체 선택 체크 · "선택 N개" · [장바구니 비우기](확인창 한 번 — 담은 수량·요청사항이 사라지므로. 서버는 기존 `POST /cart/remove` 에 전체 거래ID).
- 카드 한 장: 체크 · 사진(없으면 이미지 아이콘 자리) · 품명(누르면 상세, 칸 규칙 `openTile`) · 제조사·상품코드 · 상품상태·재고·납품희망일 · 남은 시간 · 담은 수량 `−/+`(#117 그대로, 누를 때마다 저장) · 금액(단가 × 수량) · 삭제 아이콘(한 줄 빼기).
- 거래완료 줄: "거래완료" 배지, 수량 버튼 비활성, 체크는 가능(빼기만) — 지금 표와 같은 규칙(`cartActionable`).
- 아래 고정 막대: 선택한 상품 수·합계 금액 + [선택 빼기] · [견적 요청] · [구매]. 선택이 없으면 모두 비활성. 규칙은 표에서 그대로 옮긴다: 구매는 한 번에 1개, 견적은 여러 개(최대 20, 같은 매물이 여러 줄이면 거절), 거래완료 줄은 빼고 알린 뒤 진행(`common.notice.someSkipped`).
- 모바일(390px): 사진을 위로 두고 정보·수량·금액이 한 줄씩 쌓인다. 고정 막대는 화면 아래.
- 빈 상태·로딩·오류는 지금 `CartView` 것 그대로.

### 사진 — 작은 API 추가 (스키마 변경 없음)
검색·장바구니 줄(`ListingSearchItemResponse`)에는 사진 **유무**(`hasPhoto`)만 있고 파일 키가 없다. 카드에 사진을 보이려면 `mainPhoto`(대표 사진 저장소 키, `listing.getProdPhoto1()`)를 줄에 더한다. 상세의 `photos[0]` 과 같은 값, 공개 파일이라 개인정보 아님. 검색 응답에도 같이 실린다(같은 DTO) — 검색 표는 쓰지 않는다. 사진은 `<img>` + `fileUrl()`(규칙: API 서버 업로드 파일 예외).

### 표 코드 정리
카드로 대체되면 `ResultList` 의 장바구니 전용 분기(`scope="cart"`: 열·스테퍼·[빼기]·남은 시간·`cartDefaults`·`onChangeQuantity`·`quantityBusy`)가 안 쓰인다 → 같은 PR 에서 지운다(내 변경이 만든 미사용). 장바구니 전용 `lib/cart.ts` 의 `nextCartQuantity`·`cartActionable` 은 카드가 계속 쓴다.

### 영향 검토
- API: 응답 DTO 필드 하나 추가(`mainPhoto`). 요청·상태 코드·DB 변경 없음. 프론트 타입 `ListingSearchItem` 에 필드 추가 → 테스트 픽스처(`rowEdit.test.ts`)도 맞춘다.
- 구매·견적·담은 수량 저장·1시간 자동삭제·`notifyCartChanged` 흐름은 그대로(같은 모달 `PurchaseDialog`·`QuoteDialog` 재사용, 모달 기본값 = 담을 때 입력한 값).
- 화면 표(`tileScreens`)·헤더·새 `page.tsx` 없음(`/my/cart` 그대로) → 칸 규칙 변화 없음. 모달은 기존 것.
- **다른 진행 작업과 안 겹치게**: `feat/quote-bulk-reply`(견적 일괄 회신)는 `messages/trade.ts`·`lib/api/trades.ts`·`types/trade.ts`·`QuoteRequestsDialog` 를 건드린다 → 이 작업은 그 파일들을 안 건드리고 문구는 `messages/cart.ts` 에만 더한다. `ResultList` 는 비교 누적(#118)도 건드리므로 정리 커밋을 마지막에 두고, #118 머지 뒤 `dev` 에 맞춰 다시 올린다. `docs/decisions.md` 는 맨 아래에 덧붙여 충돌을 줄인다.

## 작업
1. 백엔드: `ListingSearchItemResponse.mainPhoto` + `ListingService.toSearchItem` + `ListingSearchApiTest`(사진 있는 매물은 키, 없는 매물은 null). `./gradlew test --tests "*ListingSearchApiTest"`.
2. 프론트 lib: `types/listing.ts` 필드, `lib/cart.ts` 합계 계산(`cartLineAmount`·`cartTotal`) + 단위 테스트, 메시지(`messages/cart.ts`).
3. 프론트 화면: `CartCard`(한 장) · `CartCardList`(위 줄·카드 목록·아래 막대·구매/견적 모달 연결) · `CartView` 교체. 구매·견적 로직은 `ResultList` 에서 옮긴다.
4. `ResultList` 장바구니 분기 제거(마지막 커밋). `pnpm typecheck && pnpm lint && pnpm test`.
5. E2E `cart.spec.ts` 를 카드 화면에 맞춰 고친다(담기 → 카드·금액 → +/- → 선택 합계 → 견적·구매 → 비우기).
6. docs: `decisions.md`(맨 아래), `design.md` 장바구니 절. `./gradlew check`, E2E cart 1번, PR(`feat/cart-cards` → `dev`) → `/code-review`.
