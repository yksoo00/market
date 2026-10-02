# 매물 상세 화면 설계 (프론트 + 백엔드 응답 확장)

> 2026-10-02. 브레인스토밍에서 사용자와 합의한 내용. 사용자가 준 요구 화면(이미지 1장)을 기준으로, 우리 테이블에 없는 항목은 빼고 이미지에 없는 테이블 컬럼은 추가로 보여준다.

## 목적

검색 결과 행이 링크하는 `/listings/{userId}/{regDate}`(지금 404)에 매물 하나의 전체 정보를 보여준다. 구매자는 사진·데이터시트·서류를 보고 견적·구매로 넘어가는 자리를 얻고, 판매자는 자기 매물을 삭제할 수 있다.

## 범위

- 포함: 상세 페이지(`/listings/[userId]/[regDate]`), 백엔드 `ListingResponse` 필드 추가, 데이터시트 PDF 뷰어(blob), 서류 3종 새 탭 열기, 사진 목록, 판매자 삭제, 로딩·404·오류 상태, 문서·Bruno·테스트.
- 제외 (다음 작업): 매물 수정 화면(버튼만, "준비 중" — 상품등록 직접입력 화면과 폼을 공유할 예정), 실제 견적·구매 흐름("준비 중"), 사진 확대 보기, 판매자 정보 표시, 홈 실시간 목록 링크(`/listings/{id}` 형식, mock), 검색 API 연결(검색 결과는 아직 mock이라 거기서 누르면 404 — 검색 API 연결 시 해결).

## 선행 조건

- `feat/file-upload`(업로드·열람 API `GET /api/v1/files/{key}`)가 main에 머지돼야 사진·PDF가 실제로 보인다. 이 작업은 main에서 시작하고, 파일 업로드가 머지되면 rebase한 뒤 사진·PDF를 확인한다.
- 상품등록 화면이 다른 세션에서 동시에 진행 중이다. `types/listing.ts`, `lib/api/listings.ts`, `messages/listing.ts`, `ListingResponse`·`ListingService`가 겹칠 수 있다 — rebase 때 이쪽에서 합친다.

## 결정

- **클라이언트에서 조회.** 페이지는 클라이언트 컴포넌트가 `lib/api/client.ts`의 `api()`로 조회한다. 이유: `client.ts`가 유일한 백엔드 호출 지점이고 refresh·오류 처리가 이미 있다. 판매자 판단(`me()`)과 PDF는 어차피 브라우저에서 해야 한다. 서버 컴포넌트 fetch는 서버→API 호출 경로를 새로 만든다. 감수: 검색엔진·링크 미리보기가 내용을 못 읽는다. 재검토 조건: 검색 노출 요구가 생기면 페이지 껍데기만 서버 조회로 바꾸고 화면 컴포넌트는 그대로 쓴다. `decisions.md`에 기록.
- **PDF는 blob으로 받아 `<iframe src="blob:…">`.** API 주소를 iframe에 직접 넣으면 Spring Security 기본 `X-Frame-Options: DENY`에 막히고, access 토큰(15분) 만료 시 iframe은 refresh를 못 한다. blob 방식은 `api()`와 같은 refresh를 타고 백엔드 보안 헤더를 바꾸지 않는다. `decisions.md`에 같은 항목으로 기록.
- **판매자 판단은 표시용.** `me().id === userId`이면 판매자 버튼을 보인다. 실제 권한은 서버 403. 응답에 `mine` 같은 필드를 넣지 않는다.
- **판매자 이름·연락처는 응답에 넣지 않는다.** 화면에 없고 개인정보 규칙(CLAUDE.md 보안).

## 이미지 항목 ↔ 컬럼

| 이미지 | 컬럼 | 비고 |
|---|---|---|
| 제목: 상품명(상품번호) | `prod_name` + `prod_no` | |
| 제목 아래 한 줄 설명 | `products.prod_spec_info` | 제조사 제공 자유 기재 |
| 제조사 마크 | — | 테이블에 없음, 뺌 |
| 큰 상품 사진 | 매물 사진 첫 장 | 없으면 `products.prod_photo_1` |
| 제조사 | `prod_brand` | |
| 상품코드 | `prod_id` | `prod_no`는 제목에 있음 |
| 리드 타임 | `delivery_date` | 납기일. 날짜로 표시 |
| 상태 | `prod_state` | |
| 단가 | `sales_unit_price` | |
| 수량 | `stock_quantity` | 재고수량 (검색 결과와 같은 값) |
| 복사 버튼·부품번호 입력칸·기타 코드 | — | 뺌 |
| 제품 개요 | `listings.prod_description` | 자유 텍스트, 줄바꿈 유지 |
| 기술 사양 표 | — | 테이블에 없음, 뺌 |
| 데이터시트 PDF 뷰어 | `listings.prod_data_sheet` | 없으면 `products.prod_data_sheet` |
| 사진 목록 | 매물 사진 최대 4장 | |

이미지에 없지만 보여주는 컬럼(사용자 결정 A): 카테고리, 거래종류, 제조일, 최소주문수량, 주문단위, 등록수량, 보증기한, 불량지원방법, 등록일, 거래상태(뱃지), 테스트리포트·정품인증서·대체품(파일 링크).

## 화면

`design.md` 토큰을 쓴다. 카드는 흰 배경, 1px `line`, radius 6. 값이 없으면 `–`(`ink-3`).

### 카드 ① 상품 상세 내역

- 제목줄: 상품명 22/700 + 상품번호 mono `ink-2`. 거래완료면 '거래완료' 뱃지(`line-2`/`ink-2`, 검색 결과와 같은 모양). 아래 `prod_spec_info` 13 `ink-2`.
- 왼쪽: 큰 사진(비율 유지 `object-contain`). 사진이 없으면 선 아이콘 자리.
- 오른쪽 정보 표(라벨 `ink-2` / 값). 순서:
  1. 이미지에 있던 행: 제조사 · 상품코드(mono) · 리드 타임 · 상태 · 단가 · 수량
  2. 추가 행: 카테고리 · 거래종류 · 제조일 · 최소주문수량 · 주문단위 · 등록수량 · 보증기한 · 불량지원 · 등록일
- 정보 표 아래 버튼(34):
  - 남의 매물(비로그인 포함): [견적 요청](outline `primary`) [구매](`primary`). 누르면 버튼 위에 "준비 중" 안내 한 줄(검색 결과와 같은 모양, 닫기 ×). 거래완료면 둘 다 비활성.
  - 내 매물: [수정](outline, "준비 중" 안내) [삭제]. 삭제는 `window.confirm` → `DELETE /api/v1/listings/{userId}/{regDate}` → 성공 시 `/search`로 이동. 구매자 버튼은 숨긴다.
- 제품 개요: 제목 + `prod_description`(`whitespace-pre-line`). 없으면 "등록된 설명이 없습니다."

### 카드 ② 데이터시트

- 로그인: PDF를 blob으로 받아 iframe(데스크톱 높이 640, 모바일 480).
- 그 아래 서류 링크 3개(테스트리포트 · 정품인증서 · 대체품). 없는 서류는 `–`. 누르면 클릭 순간 빈 탭을 먼저 열고(팝업 차단 회피), blob을 받으면 그 탭 주소를 blob URL로 바꾼다. 실패하면 탭을 닫고 링크 옆에 오류 한 줄.
- 비로그인(`me()` 실패): 뷰어와 링크 대신 "로그인 후 열람할 수 있습니다" + 로그인 링크(`/login?next=<현재 경로>`).
- 데이터시트가 없으면 "등록된 데이터시트가 없습니다." (서류 링크는 그대로 보임)
- blob URL은 컴포넌트가 사라지거나 바뀔 때 `URL.revokeObjectURL`.

### 카드 ③ 사진

- 매물 사진 최대 4장을 한 줄(모바일 2열). 누르면 원본을 새 탭(공개 URL `GET /api/v1/files/{key}`). 사진이 없으면 "등록된 사진이 없습니다."

### 반응형

칸 폭 `@md` 미만(모바일·좁은 타일 칸)이면 카드 ①의 사진과 정보 표를 위아래로 쌓는다. 타일 칸(iframe) 안에서도 같은 화면. 타일 화면 표에는 이미 `listingDetail`(common)로 등록돼 있다.

## API

### `GET /api/v1/listings/{userId}/{regDate}` 응답 필드 추가

기존 필드는 그대로(직전 버전과 호환), 스키마 변경 없음. 등록·수정 응답도 같은 DTO라 함께 늘어난다.

| 필드 | 값 |
|---|---|
| `category` | `products.category_code` |
| `mufcDate` | `products.prod_mufc_date`. 숫자 8자리(`yyyyMMdd`)·14자리(`yyyyMMddHHmmss`)면 `YYYY-MM-DD`, 그 외 형식은 원문 그대로(등록 API가 형식 검사 없이 받음), 없으면 null |
| `productDataSheet` | `products.prod_data_sheet` |
| `productPhoto` | `products.prod_photo_1` |
| `tradeStatus` | `dt_expire`가 비면 `"available"`, 있으면 `"completed"` (decisions.md 2026-10-01) |
| `warrantyUntil` | `reg_date`의 날짜 + `warranty_period`일, `YYYY-MM-DD`. 기간이 null이면 null (검색 타입 `ListingSearchItem.warrantyUntil`과 같은 계산) |

- 경로의 `userId`가 UUID 형식이 아니면 500이 아니라 400 또는 404여야 한다 — 테스트로 확인하고, 500이면 `GlobalExceptionHandler`에서 고친다.

## 프론트 구성

| 파일 | 역할 |
|---|---|
| `types/listing.ts` | `ListingDetail` 타입. 백엔드 DTO와 1:1 |
| `lib/api/listings.ts` | `getListing(userId, regDate)`, `deleteListing(userId, regDate)` |
| `lib/api/client.ts` | `fetchFile(path): Promise<ApiResult<Blob>>`. 401이면 refresh 후 재시도하는 흐름을 `api()`와 공유한다. 기존 `send`는 응답 해석만 바꿀 수 있게 최소로 나눈다 |
| `lib/files.ts` | `fileUrl(key)` — `NEXT_PUBLIC_API_URL` + `/api/v1/files/` + key. 공개 사진 `<img src>`용 |
| `lib/listingDetail.ts` | 순수 함수: 경로 형식 검사(UUID + 14자리), 대체값(데이터시트·대표 사진), 날짜 표시(`regDate` → `YYYY-MM-DD HH:mm`), 정보 표 행 목록 |
| `app/listings/[userId]/[regDate]/page.tsx` | 경로 값을 받아 `ListingDetailView`에 넘김 |
| `components/listing/ListingDetailView.tsx` 외 | 카드 ①②③과 버튼. 파일이 커지면 카드 단위로 나눈다 |
| `messages/listing.ts` | 라벨·안내·오류 문구 |

흐름: 페이지 진입 → 경로 형식 검사(실패 시 바로 "찾을 수 없음") → `getListing`과 `me()` 동시 호출 → 카드 ①③ 렌더 → 로그인 상태면 카드 ② PDF blob 요청.

## 상태·오류

`design.md` "상태" 규칙을 따른다.

| 상황 | 화면 |
|---|---|
| 로딩 | 카드 3개 크기를 유지한 스켈레톤 |
| 경로 형식 오류 | API 호출 없이 "매물을 찾을 수 없습니다" + 검색 링크 |
| 404 `LISTING_NOT_FOUND` | 위와 같음 |
| 네트워크·5xx | "불러오지 못했어요" + [다시 시도] |
| PDF 받기 실패 | 카드 ② 안에서만 오류 + 다시 시도. 401(refresh도 실패)이면 "로그인 후 열람"으로 |
| 서류 링크 실패 | 열어둔 탭을 닫고 링크 옆 오류 한 줄 |
| 삭제 실패 | 버튼 옆 오류 한 줄. 코드별 문구는 `messages`, 없으면 서버 message |
| `me()` 실패(비로그인 포함) | 구매자 화면 |

## 테스트

- 백엔드 `ListingApiTest`(Testcontainers): 새 필드 6개 값, `tradeStatus` 두 경우(`dt_expire` 있음·없음), `warrantyUntil` 계산·null, `mufcDate` 8자리·14자리·그 외 형식, 비로그인 조회 200, UUID 아닌 경로가 500이 아님.
- 프론트 Vitest: `listingDetail.ts`(경로 검사, 대체값, 날짜 표시, 행 목록), `client.ts` `fetchFile`(성공 blob, 401 → refresh → 재시도, 실패 결과).
- 수동(`pnpm dev`, 파일 업로드 머지 후): 업로드 키로 등록한 매물로 사진·PDF·서류 링크·삭제. 판매자·남·비로그인 세 경우. 좁은 칸(타일 분할)·모바일 폭.

## 문서

- `design.md` 컴포넌트 규격에 "매물 상세" 추가.
- `decisions.md`: "상세 화면: 클라이언트 조회, PDF는 blob iframe" 항목 + 색인 갱신.
- `bruno/listings/get.bru` 응답 예시 갱신.
- 새 API·권한 변경이 없어 `security.md`는 그대로.

## 브랜치

`feat/listing-detail` 하나, PR 하나. 백엔드 응답 확장 커밋 → 프론트 커밋들. 스키마 변경 없음, 의존성 추가 없음. 머지 전 `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, `/code-review`.
