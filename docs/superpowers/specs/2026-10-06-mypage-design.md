# 마이페이지·헤더 사용자 메뉴 설계

2026-10-06. 사용자와 대화로 정한 범위(스펙 승인 전 초안).

## 목표

- 로그인 후 헤더의 "닉네임님 + 로그아웃"을 아바타 아이콘 하나로 바꾸고, 누르면 메뉴가 열린다.
- 마이페이지(`/my`)를 만들고 그 안에서 **내 판매글**을 본다.

## 정한 것 / 정하지 않은 것

정함:

- 아이콘은 닉네임 **첫 글자 동그라미**. 사업자는 진한 면(`primary-dark`) + 흰 테두리로 구분 (구현 중 변경: 보라 헤더 위에서 `primary-dark` 테두리만으로는 거의 안 보임). 첫 글자는 상호의 `(주)`·`㈜` 와 앞 기호를 건너뛰고 grapheme 단위.
- 메뉴 맨 위 칸: 닉네임 + 개인·사업자 배지. 이메일·전화·실명은 노출하지 않는다 (CLAUDE.md 개인정보).
- 메뉴 항목은 **마이페이지, 로그아웃** 둘. "내 판매글"은 마이페이지가 곧 그 화면이라 따로 두지 않는다.
- 설정·내 정보 관리는 화면이 없어 항목을 만들지 않는다 (갈 곳 없는 메뉴 금지). 생기면 항목만 추가.
- 비로그인 상태(로그인·회원가입)는 그대로.

정하지 않음 (이번 범위 밖): 프로필 사진, 사업체 이름 표시(`me` 응답에 없음), 관심목록, 알림 배지, 모바일 탭바 변경, 헤더 내비 정리(decisions.md 미정 목록).

## 화면

### 헤더 `UserMenu`

- `Header.tsx`의 로그인 후 영역을 `UserMenu`로 분리. shadcn `DropdownMenu`(이미 `components/ui/dropdown-menu`)를 쓴다 — 키보드·포커스·`aria` 가 따라온다.
- 트리거: 원형 버튼 36px(모바일 터치 44 확보를 위해 클릭 영역 44), `aria-label`="내 메뉴", 안에 `initialOf(nickname)`.
- 메뉴 맨 위(선택 불가): 닉네임(말줄임) + 배지. 아래 구분선, [마이페이지] 링크, 구분선, [로그아웃].
- 로그아웃: 기존 동작 그대로(`authApi.logout()`, 성공하면 프로필 비움). 진행 중 "로그아웃 중…", 실패하면 메뉴 안 항목 아래 오류 문구(`role="alert"`)로 알리고 메뉴는 닫지 않는다.
- `initialOf(nickname: string): string` — `Array.from(trim)` 첫 글자(이모지·한글 한 글자). 빈 문자열이면 "?".
- 타일 큐: 헤더 링크 규칙 그대로(`/my`는 화면 표에 없어 열면 리셋 — 의도).

### 마이페이지 `/my` (로그인 필요 → `RequireLogin`)

- 위: 사용자 카드 — 큰 이니셜 동그라미(56), 닉네임, 배지.
- 아래: **내 판매글** 제목 + 목록. 행: 대표 사진 썸네일(없으면 자리 아이콘) · 상품명 · 브랜드/번호 · 단가 · 수량 · 거래상태 배지(판매중/거래완료) · 등록일 · 액션 링크 [상세] [수정] [판매정보 추가].
- 상태: 로딩(골격), 빈 상태("등록한 판매글이 없어요" + [판매상품 등록] 링크), 오류(+재시도, RATE_LIMITED 문구), [더 보기](커서, 실패해도 보이는 목록 유지).
- `ExtraPicker`와 같은 구조(`listingsApi.mine`)지만 행 모양·액션이 달라 **별도 컴포넌트** `MyListings`로 둔다. 공통화는 3번째 사용처가 생기면.
- 남의 글은 보일 수 없다: `/mine`이 본인 글만 준다(서버 권한). 수정·추가등록 링크는 기존 화면이 다시 소유자 검사.

## 백엔드: `/api/v1/listings/mine` 응답 확장

`ListingMineItemResponse`에 필드 추가 (기존 필드·정렬·커서·PAGE_SIZE 20 그대로 — 추가등록 화면 영향 없음):

| 필드 | 값 |
|---|---|
| `salesUnitPrice` | `Integer`, null 가능(레거시) |
| `salesQuantity` | `Integer`, null 가능 |
| `tradeStatus` | `Listing.tradeStatus()` ("available"/"completed") |
| `photo` | 대표 사진 키 `prodPhoto1` (null 가능). 사진은 공개 경로(`public/listings/photos/…`)라 키 노출 무방 |

- 응답에 개인정보 없음(이메일·전화 등 미포함).
- 프론트 `ListingMineItem` 타입을 1:1로 맞춘다.

## 파일

- 백엔드: `ListingMineItemResponse`, `ListingService.mine`, `ListingMineApiTest`, `bruno/listings/mine.bru`, `docs/security.md`(응답 필드 언급 시).
- 프론트: `components/common/UserMenu.tsx`, `Header.tsx`, `lib/userMenu.ts`(+test), `components/my/MyListings.tsx`, `app/my/page.tsx`, `messages/my.ts`, `types/listing.ts`.
- 문서: `design.md`(헤더·마이페이지), `decisions.md`(헤더 사용자 메뉴 결정).

## 테스트

- Vitest: `initialOf` (한글·영문·이모지·공백·빈 문자열).
- `ListingMineApiTest`: 새 필드 값 확인(가격·수량·상태·사진), 거래완료 글의 `tradeStatus`, 사진 없음 null, 기존 6개 유지.
- UI는 브라우저 확인 체크리스트를 PR 본문에 둔다(브라우저 자동화 없음 — Playwright 는 별도 작업).

## 보안

- 새 쓰기 API 없음, 인증 변경 없음. `/mine`은 기존처럼 로그인 필수·본인 글만.
- 응답 확장 필드는 모두 본인 글의 공개 가능 정보. 개인정보 규칙 위반 없음.
