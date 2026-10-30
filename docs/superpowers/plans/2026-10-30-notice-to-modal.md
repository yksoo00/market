# 클릭 후 안내를 모달로 — 계획

이 파일은 설계 + 작업 (CLAUDE.md "중간 크기 기능" — 새 테이블·인증 변경 없음, 프론트만). 승인은 이 파일 한 번, 구현은 직접, PR 에서 `/code-review` 한 번. 브랜치 `feat/notice-modal` (main 에서, 거래이력 필터 브랜치와 따로).

## 설계

### 확정된 것 (사용자 2026-10-30)

- 버튼·메뉴를 눌렀을 때 화면 구석에 한 줄로 뜨고 × 로 닫는 안내는 전부 **모달**로 띄운다. "같은 카테고리(소분류) 상품끼리만 비교할 수 있어요." 같은 것.
- 모양은 기존 `ResultDialog`(design.md "결과 팝업") 재사용. 새 모달 모양을 만들지 않는다.
- 폼 필드 옆 오류 문구(입력 검증)는 그대로 — rules/frontend.md "필드 옆 빨간 문구".

### 대상 (코드 확인 결과)

| 위치 | 지금 | 안내 종류 |
|---|---|---|
| `search/ResultList.tsx` `notice` 줄 (`showNotice` 7곳) | 목록 아래 한 줄 + × | 비교 개수 초과·다른 카테고리, 견적 20개 초과, 담기 20개 초과, 구매 한 번에 하나, 완료 매물 건너뜀, 서버 오류(`trade.errors`) |
| `home/QuickMenu.tsx` `notice` | 아이콘 줄 아래 한 줄 + × | 파일 형식·크기 오류(error), 파일 확인 완료·등록 준비 중(성공) |
| `common/AppLauncher.tsx` `notice` | 메뉴 안 회색 박스 + × | 위와 같은 파일 선택 결과 |
| `cart/CompareView.tsx` `removeError` | 표 위 빨간 한 줄 | 비교에서 빼기 실패 |

### 계획이 정한 것 (검토 때 확인)

1. 뺀 것: `PurchaseDialog` 안의 `notice`(이미 모달 안), `CompareView` 의 `tooFew`·`removedSkipped`·다른 카테고리 `Message`(클릭 결과가 아니라 지금 화면의 **상태 설명**), 가입·비밀번호 찾기 폼의 `role="status"`(폼 흐름), `PhotoUploader`(필드 오류). 이것들도 모달로 바꿀지는 말해 주면 한다.
2. 공용 얇은 부품 `components/common/NoticeDialog.tsx` 하나: `ResultDialog` 에 [확인] 버튼 하나(`onAction` = 닫기)와 `onClose` 를 붙인 래퍼. 호출 쪽은 `{ tone, title, message, seq }` 상태 하나를 들고 `onClose` 에서 비운다 (`seq` 는 같은 안내가 연달아 나와도 다시 열리게).
3. `ResultDialog` 톤은 `success | error` 둘뿐이다. 막힘·한도 안내는 `error`(느낌표 아이콘 `down` 색), 파일 확인 완료는 `success`. 새 톤(`info`)은 만들지 않는다.
4. 제목(`title`)은 `ResultDialog` 가 필수로 요구하므로 안내마다 짧게 정한다 — 아래 문구 표는 제안이고 `messages/` 에 둔다.
5. 홈 아이콘 줄·앱 런처의 파일 고르기는 모달이 뜨면 메뉴(Radix DropdownMenu)의 포커스·닫힘과 부딪칠 수 있다 → 앱 런처는 모달을 띄우기 전에 메뉴를 닫는다 (지금은 "결과가 메뉴 안에 보이게" 일부러 열어 둠 — 이유가 없어지므로 `onPick` 의 `preventDefault` 와 `setNotice(null)` 닫힘 처리도 같이 정리한다).
6. `dismiss` 문구(`search.ts`·`listing.ts`·`home.ts` 의 "알림 닫기")와 × 버튼 코드는 쓰는 곳이 없어지면 지운다 (내 변경이 만든 미사용만).
7. 기존 E2E `compare.spec.ts:110` 은 `getByRole("status")` 를 기대 → 모달(`alertdialog`) 기대로 바꾼다. 모달이 열려 있으면 바깥이 aria-hidden 이라 확인 후 [확인]으로 닫고 다음 단계로 간다 (rules/frontend.md 테스트 절).

### 문구 제안 (제목 / 본문은 기존 문구 그대로)

| 안내 | 제목 |
|---|---|
| 비교 개수 초과·다른 카테고리·비교 서버 오류 | 비교할 수 없어요 |
| 견적 개수 초과 | 견적을 보낼 수 없어요 |
| 담기 개수 초과·담을 매물 없음 | 담을 수 없어요 |
| 구매 한 번에 하나 | 구매를 시작할 수 없어요 |
| 완료 매물 건너뜀 | 일부 매물은 제외했어요 |
| 파일 형식·크기 오류 | 파일을 올릴 수 없어요 |
| 파일 확인 완료 | 파일을 확인했어요 |
| 비교에서 빼기 실패 | 뺄 수 없어요 |

## 작업

각 작업: 바꾼 영역 테스트 + typecheck·lint 항상 같이.

### 작업 1 — 부품
- `NoticeDialog` + `messages/` 제목. 단위 테스트 대상 로직은 없어 컴포넌트 테스트는 쓰지 않고 사용처 E2E 로 확인한다.

### 작업 2 — 검색 결과
- `ResultList`: `notice` 줄을 `NoticeDialog` 로, `showNotice` 가 `{ tone, title, text }` 를 받게. 호출 7곳에 제목.

### 작업 3 — 파일 선택 안내 (홈·앱 런처)
- `QuickMenu`·`AppLauncher`: 파일 선택 결과를 `NoticeDialog` 로. 앱 런처는 메뉴를 닫고 띄운다 (계획 5).

### 작업 4 — 비교 화면
- `CompareView` `removeError` → `NoticeDialog`.

### 작업 5 — 정리·검증
- 안 쓰는 `dismiss` 문구·× 버튼 정리. `docs/design.md` "결과 팝업" 에 "클릭 후 안내도 같은 팝업" 한 줄과 `decisions.md` 2026-10-30 항목(안내는 모달, 필드 오류는 인라인 유지, 이유 = 사용자 지시).
- `pnpm typecheck && pnpm lint && pnpm test`, E2E 는 `compare` spec 만 1번 (+ 파일 선택 안내가 걸린 spec 이 있으면 그것).
- 새 화면은 아니지만 모달이라 체크리스트 5번: 3분할 오른쪽 아래 칸(960×500, 640×330)에서 모달이 안 잘리는지 직접 열어 본다. 검색 결과 2분할·3분할에서 안내를 띄워 보고 결과 보고에 적는다.

## 영향 검토

- API·DB 변경 없음, 프론트 표시만 바뀐다. 안내 문구 본문은 그대로, 제목만 새로 생긴다.
- 사용성: 안내가 구석 한 줄에서 화면 가운데 모달로 바뀌어 클릭이 한 번 더 든다 (사용자 지시).
- 타일 엔진: 모달은 그 칸 안에서 열린다 (`Dialog` 가 칸 기준인지 `ResultDialog` 기존 동작 그대로 — 확인 항목).
