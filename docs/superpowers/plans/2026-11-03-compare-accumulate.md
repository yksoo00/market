# 비교 누적 담기 + 헤더 비교 + 상세에서 담기 (2026-11-03)

## 설계

사용자 지시(2026-11-03 대화): 비교를 "누를 때마다 지우고 새로 담는" 1회용에서 **쌓이는 목록**으로 바꾼다. 상세 화면에서도 담고, 헤더의 시세 자리에 비교를 둔다.

### 결정 (사용자 지시 + 합의한 추천안)
- 헤더 `시세` → `비교`(`/my/cart/compare`). 비교 화면이 비었을 때 "비교할 상품을 추가해주세요" + [상품 검색].
- 비교 목록은 쌓인다. 최대 4개, 같은 소분류만. 재고는 안 묶는다(비교용은 `HOLDING_STATS` 밖).
- 비교 화면에 [비교 비우기]. 열마다 [빼기]는 그대로.
- 상세에 [비교에 담기] (이미 담겼으면 [비교에서 빼기]). 4개가 찼거나 소분류가 다르면 모달: [비교 보기] · [비우고 새로 담기] · [취소].
- 검색 목록의 [비교] 는 **[비교에 담기]** 로 바꾼다(체크 1개 이상). 쌓는 뜻이라 상세와 같게 통일. 담은 뒤 "비교에 담았어요" + [비교 보기] 안내(장바구니 담기와 같은 `ResultDialog`).
- 이미 담긴 상품은 건너뛰고 건너뛴 수를 알린다.
- 10-29 "[비교]를 누를 때마다 내 `비교용` 행을 지우고 새로 담음" 을 뒤집는다 → decisions.md 에 추가.

### API (스키마 변경 없음. 새 라이브러리 없음)
- `POST /api/v1/cart/compare` `{ items: [{sellerId, regDate}] }` (1~4개) — 기존 목록에 더한다. 응답 `{ count, skipped }`.
  - 이미 담긴 매물은 건너뜀(skipped). 새로 더할 게 없으면 200.
  - 기존 + 새 것이 4개 초과 → 400 `COMPARE_FULL`. 기존·새 것의 소분류가 하나가 아니면 400 `COMPARE_CATEGORY_MISMATCH`. 내 매물 → `TRADE_OWN_LISTING`, 없는 매물 → 기존 코드.
  - `lockCompare` 로 구매자별 직렬화(동시에 담아 4개 넘는 경합 방지).
- `PUT /api/v1/cart/compare` (교체) 는 **남긴다** — 모달 [비우고 새로 담기]가 한 번에(검사 통과 뒤에만 지움) 쓴다. 최소 개수 2 → 1 로 낮춘다(`COMPARE_COUNT` 는 1~4 밖일 때).
- `DELETE /api/v1/cart/compare` — 내 비교 목록 전체 비우기 → 204. (본문 없음이라 DELETE)
- `POST /compare/remove`, `GET /compare` 그대로.
- "2개 이상이어야 비교" 는 담을 때가 아니라 **비교 화면**에서만 안내(이미 `tooFew`).

### 화면
- `CompareView`: 빈 문구 교체, 상단에 [비교 비우기](확인 없이 바로 비우고 빈 상태로), 1개일 때 안내 문구 유지.
- `ListingActions`: 남의 매물일 때만 [비교에 담기]/[비교에서 빼기]. 담긴 여부는 마운트 시 `GET /compare` 로 확인(로그인한 경우만). 비로그인이면 다른 버튼처럼 로그인으로.
- `ResultList`(검색): 버튼 문구·활성 조건(1개 이상) 변경, `replaceCompare` → `addCompare`, 실패 코드 `COMPARE_FULL`/`COMPARE_CATEGORY_MISMATCH` 면 모달.
- 모달 `CompareConflictDialog`(검색·상세 공용): 사유 문구 + [비교 보기] [비우고 새로 담기] [취소]. 기존 `ResultDialog` 가 버튼 2개를 못 받으면 shadcn dialog 로.
- `Header`: `navHrefs` 의 `/prices` → `COMPARE_HREF`, `messages/home.ts` nav 의 "시세" → "비교". 헤더 nav 는 `md` 이상만 보인다(모바일은 변경 없음 — 비교로 가는 모바일 길은 이번 범위 밖, 보고에 적는다).

### 새 화면·모달 체크리스트(frontend.md)
1. 화면 표: `/my/cart/compare` 는 이미 `cartCompare`(buy) 로 등록돼 있다. 새 `page.tsx` 없음.
2. 코드 이동은 `useTileOpen()` (모달의 [비교 보기]).
3. 헤더 링크는 `<header data-tile-from-home>` 아래라 홈에서 연 것처럼 새 주기능으로 열린다. 새 포털 메뉴 없음.
4. 직접 확인할 것: 헤더로 열기 `[홈 | 비교]`, 상세(주기능)에서 [비교 보기] → `[홈 | 상세 | 비교]`, 새로고침 복원.
5. 모달 크기: 3분할 오른쪽 아래 칸(640×330)에서 안 잘리는지.
6. E2E 기대는 칸 규칙대로.

### 영향 검토
- `비교용` 행은 매물당 1행 unique 인덱스(`ux_trd_trade_info_one_compare`)가 중복을 막는다. 새 마이그레이션 없음.
- 거래완료·삭제된 매물 정리(`TradeListingCleanup`)는 `COMPARE` 행도 이미 지운다 — 변경 없음.
- 비교 화면의 견적·구매는 장바구니 행을 바꾸고 비교 행은 그대로 — 변경 없음.
- 장바구니 카드(쿠팡식) 개편은 **이번 범위 밖**, 비교 뒤에 따로.

## 작업
1. 백엔드: `CompareService.add`·`clear`, `replace` 최소 1개, `CompareRequest` 최소 1개로 완화, `CartController` POST/DELETE `/compare`, `ErrorCode.COMPARE_FULL` + `COMPARE_COUNT` 문구 정리. 테스트(`CompareApiTest`): 누적, 중복 건너뜀, 5번째 400 `COMPARE_FULL` 이전 목록 그대로, 다른 소분류 400, 내 매물, 비우기, 비우기 뒤 담기, 교체 1개, 비로그인 401. Bruno `compare-add.bru`·`compare-clear.bru`, `compare-replace.bru` 설명 갱신.
2. 프론트 lib·메시지: `cartApi.addCompare`·`clearCompare`, `lib/compare.ts`(`compareBlock` 최소 개수 제거, 하한·상한은 담을 때 기준), `messages/compare.ts`·`trade.ts` 오류 키 `COMPARE_FULL`, 단위 테스트(`compare.test.ts`).
3. 프론트 화면: 헤더, `CompareView`, `ListingActions`, `ResultList`, `CompareConflictDialog`.
4. E2E `compare.spec.ts` 갱신(검색에서 담기 → 상세에서 담기 → 4개 꽉 참 모달 → 비우기). docs: decisions.md(10-29 일부 대체), design.md 헤더 메뉴 문구가 있으면 맞춤.
5. `./gradlew test --tests "*CompareApiTest"` → PR 직전 `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, E2E compare 1번, PR(`feat/compare-accumulate` → `dev`) → `/code-review`.
