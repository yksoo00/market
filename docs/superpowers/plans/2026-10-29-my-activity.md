# PR 4 — 메뉴·내 활동내역·내 거래이력·검색 범위 탭 계획

설계 원본: `docs/superpowers/specs/2026-10-27-definition-realign-design.md` "PR 4". 이 파일은 설계 + 작업 (CLAUDE.md "중간 크기 기능" — 새 테이블·인증 변경 없음). 승인은 이 파일 한 번, 구현은 직접, PR 에서 `/code-review` 한 번.

기반: #88(상품마스터)·#89(장바구니)가 main 에 머지된 뒤 `feat/my-activity` 를 main 에서 판다. 이 PR 은 DB 스키마를 바꾸지 않는다.

## 설계

### 확정된 것 (설계서 + 사용자 2026-10-29)

- 헤더 사용자 메뉴: 마이페이지 · 내 활동내역 · 내 거래이력 · 로그아웃. 마이페이지 바로가기 카드도 같은 둘.
- 내 활동내역 `/my/activity?tab=requests|sales|purchases` (기본 `requests`).
  - 요청: 받은 견적 [수락]·[거절], 받은 구매요청 [취소]. 진행 중만 (`견적요청`, `구매요청`). 판매자 거래 목록.
  - 판매: 지금 `/my/listings` 화면 그대로. "구매요청 N건" 링크는 같은 페이지 요청 탭, 그 매물로 걸러서 (`?tab=requests&reg=`).
  - 구매: 보낸 견적·구매중. 진행 중만 = `견적요청`·`견적수락`·`견적거절`·`구매요청` (사용자 확정 2026-10-29 "a"). 구매자 거래 목록.
- 내 거래이력 `/my/history?tab=all|buy|sell` — `trd_trade_history` 에서. 구매 = `user_id` 가 나, 판매 = `seller_id` 가 나. 줄: 확정일시·상품명·상대 닉네임·단가·수량·금액, 전체 탭은 구매/판매 표시. 새 API `GET /api/v1/trades/history?side=all|buy|sell&cursor=`.
- 검색 범위 탭 (`/search` 맨 위): 판매만 있으면 [전체·내 판매], 구매만 있으면 [전체·내 구매], 둘 다면 [전체·내 판매·내 구매], 둘 다 없음·비로그인이면 탭 줄 없음.
  - 판정 `GET /api/v1/trades/scopes` → `{ sales, purchases }`. sales = 내 매물 1개 이상, purchases = `구매검토` 아닌 구매자 거래 행 또는 거래이력 1건 이상. 거래 도메인이 매물 서비스를 부른다(거래 → 매물, 순환 없음).
  - 내 구매 결과: `GET /api/v1/trades/listings` 가 내 거래(구매검토 제외 + 거래이력)의 매물 키를 모아 매물 검색 서비스에 넘긴다 — 같은 필터·같은 응답.
- 지우는 화면: `/my/listings`, `/my/sales`, `/my/purchases` → 내 활동내역 탭으로. 링크(홈 아이콘 줄·결과 대화상자 [내 구매목록]·`AppLauncher`·`QuickMenu`·`ListingActions` 등)는 새 주소로.

### 계획이 정한 것 (설계서가 직접 말하지 않음 — 검토 때 확인)

1. 옛 주소 `/my/listings`·`/my/sales`·`/my/purchases` 는 404 로 두지 않고 새 주소로 `redirect` (북마크·메일 링크 보호). 운영 전이라 비용이 작다. 다음 PR 에서 지운다.
2. "내 구매" 범위는 검색 필터(`q`·`category`·`status` 등)를 그대로 받는다. 거래한 매물이 지금 판매완료여도 보인다(상태 기본값 "전체"로 시작 — "내 판매"와 같음).
3. 내 거래이력은 매물이 지워졌어도 상품명을 보이려고 이력에 상품명을 따로 저장하지 않는다 — `prod_id` 로 상품마스터를 읽는다(상품마스터는 안 지워짐). 상대 닉네임은 `userDirectory.nicknamesOf`.
4. 요청 탭은 판매자 행의 기존 [수락]·[거절]·[취소] 동작을 그대로 쓴다(`TradeList` role=seller 재사용). 구매 탭도 `TradeList` role=buyer 재사용, 진행 중 4상태로 거른다(서버 `findBuyerPage` 는 이미 `구매검토` 제외 — 구매확정(거래완료)은 제외 조건만 확인).
5. 페이지 번호는 PR 5. 이 PR 의 목록은 지금처럼 [더 보기].

## 작업

각 작업: 실패하는 테스트 먼저 → 구현 → 바꾼 영역 테스트. 커밋은 작게.

### 작업 1 — 백엔드: 거래이력·범위·내 구매 매물 API
- `TradeHistoryRepository`: 내 구매/판매/전체 페이지(커서 = `trade_date`+`trade_id` 키셋), 내 이력 존재 여부.
- `TradeService`(또는 `TradeHistoryService`): `history(me, side, cursor)` → 상품명·닉네임 붙인 `TradeHistoryPageResponse`; `scopes(me)` → `{sales, purchases}` (`ListingService` 에 "내 매물 있나" 메서드 추가); `purchasedListingKeys(me)` → 매물 키 집합.
- `TradeController`: `GET /history`, `GET /scopes`.
- `ListingSearchCondition`/`ListingSearchRepository`/`ListingController`: 내 구매 범위 — 매물 키 집합으로 거르는 조건 하나 추가. 키 집합은 거래 도메인이 만들어 넘긴다(컨트롤러가 거래 서비스에서 받아 검색 서비스에 전달 — 매물 → 거래 역참조 금지, `pending-counts` 와 같은 이유).
- 테스트(Testcontainers): 범위 판정 4경우, 내 구매 결과(진행 중 + 구매확정, `구매검토`는 제외), 거래이력 탭 3개, 남의 거래·이력이 안 보임, 잘못된 side 400, 비로그인 401.
- `bruno/` 새 요청 3개.

### 작업 2 — 프론트: 메뉴·마이페이지·옛 주소
- `UserMenu`: 항목 교체(내 활동내역·내 거래이력). `MyHub` 카드 교체. `messages/my.ts` 문구.
- `/my/listings`·`/my/sales`·`/my/purchases` → `redirect`(요청 `?reg=` 는 `?tab=requests&reg=` 로).
- 링크 갱신: `AppLauncher`, `QuickMenu`, `ListingActions`, `CompareView`, `ResultList`(대화상자 [내 구매목록]), `SearchForm`, `lib/search.ts`·`tradeCounts.ts` 의 경로 상수. 타일 엔진(`tileScreens`·`tileQueue`) 화면 목록과 테스트도 같이.
- 테스트: `lib/*.test.ts` 경로 기대값, `UserMenu` 항목.

### 작업 3 — 프론트: 내 활동내역 화면
- `/my/activity` 페이지 + 탭 줄(`?tab=`; 모르는 값은 `requests`). 요청 탭 = `TradeList role="seller"`(`reg` 지원), 판매 탭 = `MyListingsView`, 구매 탭 = `TradeList role="buyer"`. 탭 이동은 `Link`(칸 엔진 규칙).
- 판매 탭 "구매요청 N건" 링크 → `/my/activity?tab=requests&reg=`.
- 테스트: 탭 파싱 단위 테스트, E2E 는 작업 5.

### 작업 4 — 프론트: 내 거래이력 + 검색 범위 탭
- `/my/history` 페이지 + 탭(전체·구매·판매) + 줄 컴포넌트 + `lib/api/trades.ts` `history()`. 빈 상태·오류·[더 보기] 는 `TradeList` 규칙대로.
- `SearchScopeTabs`: `scopes()` 를 읽어 탭 구성. `lib/search.ts` 범위를 `mine: boolean` → `scope: "all"|"sales"|"purchases"` 로 넓힌다(주소 `?scope=`, 옛 `?mine=1` 도 `sales` 로 읽음). API 파라미터 대응.
- 테스트: `search.test.ts`(범위 파싱·주소·API 파라미터), 탭 구성 함수 단위 테스트(4경우).

### 작업 5 — 문서·검증
- `docs/design.md`(메뉴·탭·거래이력 줄), `docs/decisions.md` 2026-10-29 항목(내 활동내역 통합, 구매 탭 진행 중 4상태), `docs/security.md`(새 읽기 API 는 본인 id 인증 정보에서만, 남의 이력 안 보임), `docs/data-model.md` 변경 없음 확인.
- `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, E2E: 활동내역 요청→수락 흐름과 범위 탭 spec 1번(별도 DB). 기존 `purchase`·`quote`·`flow` spec 의 옛 주소 클릭은 새 주소로 고친다.

## 영향 검토

- API: 읽기 3개 추가, 기존 응답 변경 없음 → 롤링 호환. `?mine=true` 는 그대로 받는다.
- 화면 흐름: 옛 주소 redirect 로 링크 호환. 타일 엔진 화면 목록·큐 테스트 갱신.
- 개인정보: 이력·범위 응답에 이메일·전화 없음(닉네임만). 본인 id 는 인증 정보에서만.
- 거래 → 매물 방향 의존만 추가(순환 없음).
