# 장바구니 담은 수량 +/- (2026-11-02)

## 설계

사용자 지시: 장바구니 표에서 **담은 수량이 먼저 보이고**, 쿠팡처럼 +/- 로 바꾼다. 결정(사용자 선택):

- 누를 때마다 **바로 서버에 저장**한다. 저장 버튼 없음.
- 한 번에 **주문단위**만큼 늘고 준다. 최소주문량 아래로는 못 내린다(없애려면 [빼기]).
- 수량을 바꿔도 **담은 시각(1시간 자동삭제)은 그대로**. 수량을 계속 만져 재고를 무한정 잡아 두는 걸 막는다.

### 화면
- 열 순서: 체크 · 상품명 · **담은 수량(−/숫자/+)** · 나머지 매물 열 · 납품희망일 · 남은 시간. 담은 수량이 상품명 바로 옆.
- `−` 는 담은 수량 = 최소주문량이면 비활성, `+` 는 지금 재고(묶이지 않은 수량) < 주문단위이면 비활성(서버가 최종 판정).
- 거래완료 매물 줄은 둘 다 비활성. 요청 중인 줄은 두 버튼 모두 비활성(중복 클릭 방지), 실패하면 표 위에 서버 문구를 붙이고 다시 읽는다.
- 버튼 접근 이름: "수량 줄이기/늘리기".

### API
`PATCH /api/v1/cart/{tradeId}` `{ orderQuantity }` → 200 `{ tradeId, orderQuantity }`.
- 내 장바구니 줄이 아니면 404 `TRADE_NOT_FOUND`.
- 규칙은 담기와 같다: 최소주문량·주문단위 배수·금액 상한(`rules.quantityFailure`), 거래완료 409 `LISTING_COMPLETED`, 틀리면 400 `fields["orderQuantity"]`.
- 늘리면 그 차이만큼 `tryReserveStock`, 모자라면 400 `fields["orderQuantity"]` "현재 재고(N)보다 많이 담을 수 없습니다." 줄이면 `releaseStock`.
- 잠금: 줄을 `findForUpdateByTradeId` 로 잠근 뒤 매물을 `lockForTrade`(배타). 자동삭제(`expire`)·구매·견적 전환도 같은 줄을 먼저 잠그므로 차이가 두 번 풀리거나 지운 줄을 바꾸지 않는다. 줄 → 매물 순서는 `takeCartRow` 와 같다.
- `trd_trade_info.order_quantity` 와 `trd_cart_info.order_quantity` 를 같이 바꾼다. 담은 시각·납품희망일·요청사항은 그대로.

### 영향 검토
- 구매·견적은 줄의 `orderQuantity` 를 읽어 기본값으로 쓰므로 바뀐 수량이 그대로 간다.
- DB 스키마 변경 없음. 새 라이브러리 없음.

## 작업
1. 백엔드 `CartService.changeQuantity` + `CartController` PATCH + 요청 DTO `CartQuantityRequest`(@Min(1) @Max(MAX_QUANTITY)). 테스트(`CartApiTest`): 늘림/줄임 재고 반영, 재고 초과 400·원복, 최소주문량·주문단위 위반 400, 남의 줄 404, 동시에 마지막 1개, 담은 시각 그대로, 구매에 바뀐 수량 반영.
2. Bruno `bruno/trades/cart-quantity.bru`, security.md 장바구니 표, decisions.md.
3. 프론트: `cartApi.changeQuantity`, `ResultList` 열 순서와 스테퍼(`QuantityStepper`), `CartView` 가 바꾼 뒤 다시 읽기, 메시지(`cart.ts`), 단위 테스트(스테퍼 상한·하한 계산 `lib/cart.ts`), E2E `cart.spec.ts` 에 +/- 단계.
4. `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, E2E cart 1번, PR → `/code-review`.
