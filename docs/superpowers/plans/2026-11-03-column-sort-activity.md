# 열 머리 클릭 정렬 — 3단계: 활동내역 요청·구매 표 + 필터 칩 줄 (2026-11-03)

## 설계
1·2단계(`2026-11-03-column-sort-listings.md`·`-history.md`)의 결정 그대로. 이번은 내 활동내역의 **요청 탭(받은 요청 = role=seller)·구매 탭(role=buyer)** 표(`TradeList`). 판매 탭은 1단계의 검색·내 판매 표라 이미 됐다.

- 열: 상품명·상대(구매 탭은 판매자, 요청 탭은 구매자)·수량·단가·금액·납품희망일·상태. sort 값: `latest`·`oldest`(기존) + `열이름Asc|Desc`(name·party·quantity·unitPrice·amount(기존)·reqDeli·status). 처리 열(버튼)은 정렬 대상이 아니다.
- 서버: `TradeInfoRepository.findBuyerKeys/findSellerKeys` 가 정렬용 값(판매자·상품·수량·단가·납품희망일·상태)까지 가진 키를 읽고 `TradeService.keyOrder` 가 자바에서 정렬한다(2단계 거래이력과 같은 방식, 공용 `TradeKeySorting.columnOrder`). 상품명은 상품마스터, 상대는 화면에 보이는 별명, 상태는 진행 순서(견적요청 → 견적수락 → 견적거절 → 구매요청), 납품희망일은 문자열 순서가 날짜 순서. 같은 값은 최신(거래ID 내림), 비어 있으면 맨 뒤(상품명·별명이 비는 경우만 — 나머지는 필수 컬럼).
- `TradeFilterRules.ACTIVITY_SORTS` 에 위 값을 더한다. 거래이력 전용 값(구분)은 여전히 400.
- 프론트: `TRADE_SORT_COLUMNS`·`TRADE_SORTS`·`tradeSortColumn`, 칩 글자는 이 목록의 열 이름("상대 ▲"), `TradeList` 열 머리를 `SortableTh`, 정렬 이동은 `router.push(…, { scroll: false })` + `rememberXScroll`. 검증 스키마는 이 목록의 sort 값을 받는다(`listFilterSchema(statuses, sorts)`).

### 필터 칩 줄 (사용자 지시 2026-11-03)
정렬 칩 글자가 길어져(예: "정렬: 최소 주문 수량 ▲") 칸이 좁으면 칩 줄에 가로 스크롤바가 생겼다 → 줄을 한 줄 스크롤이 아니라 **줄바꿈**으로 바꾸고(`DetailFilter` 툴바, 좁은 칸은 간격 6px), 정렬 칩 글자는 열 이름을 짧게("최소주문").

### 영향 검토
- API: 새 엔드포인트 없음, `sort` 허용 값만 늘어남. 스키마 변경 없음. 키 조회 쿼리의 선택 열이 늘었다(`TradeService` 만 읽음).
- 칩 줄 줄바꿈은 검색·거래이력·활동내역 모두에 적용 — 좁은 칸에서 칩이 두 줄이 되면 결과가 조금 밀린다(스크롤바 없음을 택함).
- #125(2단계) 위에 쌓음 — `TradeList` 의 `StickyXScroll` 이 그 PR 에 있다.

## 작업
1. 백엔드: 키 조회 확장·`keyOrder`·`TradeKeySorting`, `ACTIVITY_SORTS`. `TradeActivityApiTest`(열마다 오름·내림·끝맞춤, 구분은 400).
2. 프론트: `tradeFilter`·`TradeList`·검증 스키마·문구, 칩 줄 줄바꿈. 단위 테스트, E2E(`column-sort.spec.ts` 좁은 화면 칩 줄).
3. docs → `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, PR → `/code-review`.
