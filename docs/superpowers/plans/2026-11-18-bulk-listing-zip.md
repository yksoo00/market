# 엑셀 다량 등록에 ZIP(사진·데이터시트) 선택 첨부 (2026-11-18)

> **구현 방식:** CLAUDE.md "중간 크기 기능"대로 이 파일 승인 뒤 직접(native) 구현. 작업마다 리뷰하지 않고 PR 에서 `/code-review` 한 번. 단계는 `- [ ]` 로 추적.

**Goal:** 다량 등록 때 엑셀과 함께 ZIP 을 **선택으로** 올리면, 엑셀 칸에 적은 파일명과 ZIP 안 파일명이 같은 파일을 그 줄 매물의 사진·데이터시트로 붙인다. ZIP 이 없으면 지금처럼 엑셀만으로 등록한다.

**Architecture:** 서버는 stateless 유지. `parse` 가 ZIP 을 풀어 파일마다 단건 업로드와 같은 검사를 하고 `UploadService` 규칙(키 발급 + Redis `upload:<key>` 24시간)으로 저장한다. 줄 데이터(`BulkRowDto`)에 키를 담아 브라우저가 들고 있다가 `check`/`commit` 때 다시 보낸다. `commit` 은 키를 `UploadService.claim` 으로 선점한다 (엑셀 칸 값이 아니라 **키**만 믿는다).

**Tech Stack:** Spring Boot 4.1, JDK `java.util.zip`, Next.js 16. **새 라이브러리 없음, DB 스키마 변경 없음** (`Listing` 에 사진·데이터시트 칸이 이미 있다).

## 설계

### 정해진 것 (사용자 확인 2026-11-18)

- ZIP 은 **선택**. 사진 없이도 등록 허용 (지금 동작 유지 — 단건의 대표 사진 필수 규칙은 단건에만, 2026-11-05 계획 그대로).
- 연결 방식은 **파일명 일치**: 엑셀 칸의 이름 = ZIP 안 파일 이름. (폴더명=행 번호 안은 버림.)
- ZIP + 엑셀 총 용량 **50MB**.

### 내가 정한 가정 (승인 때 확인)

1. **엑셀 칸 5개 추가**: `사진1`~`사진4`, `데이터시트` (전부 선택, 파일명 글). 단건 등록이 받는 것(사진 최대 4장, 데이터시트 1개)과 같은 범위. 테스트리포트·정품인증서는 단건도 등록 때 안 받으므로(수정에서만) 제외.
2. **ZIP 은 폴더 없이 파일만**. 폴더·중첩 ZIP·`../` 경로(zip-slip)는 `file` 오류로 거절. 이름 비교는 대소문자 무시, 앞뒤 공백 제거.
3. **헤더 호환**: 새 5칸이 없는 옛 양식도 읽는다 (칸 없으면 빈 값). 양식은 새 칸을 포함해 다시 만든다. 옛 양식을 거절하면 이미 내려받은 양식이 갑자기 깨져서.
4. **사진 우선순위**: ZIP 사진이 하나라도 있으면 그 줄은 ZIP 사진만 (`photos[0]` 이 대표). 없으면 지금처럼 마스터 사진 복사. 데이터시트도 같은 규칙.
5. **파일 종류 검사는 단건과 같은 코드**: 사진 jpg·png·webp 5MB 이하, 데이터시트 pdf 10MB 이하, 확장자 + 매직바이트, 빈 파일 거부. 새로 쓰지 않고 `UploadService` 의 검사를 재사용(저장 전 단계 분리).
6. **고아 파일**: `parse` 에서 저장했는데 commit 안 하면 파일이 남는다. 단건과 같은 정책(고아 파일은 당분간 수동 정리, security.md). ZIP 에서 엑셀 줄이 안 쓴 파일은 **저장하지 않는다**(이름이 어느 칸에도 없으면 무시하고 안내만).
7. **같은 파일명을 여러 칸·줄이 쓰면** 줄마다 따로 저장해 키를 각각 발급한다(한 키를 두 매물이 공유하지 않게 — `claim` 은 같은 키를 두 번 못 쓴다).

### 상한 (security.md 에 같은 PR 로 반영)

| 항목 | 값 |
|---|---|
| 요청 총 용량 (엑셀 + ZIP) | 50MB. `spring.servlet.multipart` 는 전역이라 **전역을 50MB 로 올리고**, 용도별 상한(사진 5MB·pdf 10MB·엑셀 10MB)은 서비스가 계속 검사한다 |
| ZIP 해제 총량 | 100MB (압축률로 부풀리는 zip bomb 방지. 읽으면서 센다) |
| ZIP 안 파일 수 | 200 × 5 = 1,000개 이하 |
| 파일 하나 | 사진 5MB, pdf 10MB (읽으면서 센다 — 헤더의 크기 값은 믿지 않는다) |

### API 변경 (`/api/v1/listings/bulk`)

- `POST /parse`: multipart `file`(엑셀) + 선택 `attachments`(ZIP). ZIP 이 있으면 `BulkRowDto` 의 새 칸에 **업로드 키**를 채워 돌려준다.
- `BulkRowDto` 추가(전부 문자열): `photo1`~`photo4`, `dataSheet` = 엑셀에 적은 **파일명**(화면 표시용), `photoKeys`(최대 4), `dataSheetKey` = 서버가 발급한 키. `check`/`commit` 은 키만 본다. 키가 없는 줄에 파일명만 있으면 "ZIP 에서 찾을 수 없습니다" 줄 오류.
- 줄 오류 문구(칸 옆에 표시): 파일명이 ZIP 에 없음 / 종류가 안 맞음(예: `사진1` 에 pdf) / 용량 초과 / 사진 칸 4개 초과 불가는 칸이 4개라 해당 없음.
- 키 검증: `commit` 은 `claim` 으로 "본인이 24시간 안에 이 용도로 올린 키"만 받는다 (본문의 키를 그대로 믿지 않음). 24시간 지났거나 남의 키면 400 `VALIDATION` "파일을 다시 올려 주세요." — 화면은 그 줄만 다시 올리게 안내.
- 새 오류 코드 없음 (기존 `VALIDATION`·`UPLOAD_TOO_LARGE`·`UPLOAD_INVALID_TYPE` 재사용 — 있으면 프론트 문구도 이미 있다).

### 화면

- 기존 다량 등록 모달의 드롭존이 `.xlsx` 하나만 받던 것을 **엑셀 + (선택) ZIP** 으로. 두 파일 칸을 나란히: [엑셀 선택] [ZIP 선택(선택)]. 끌어 놓기는 두 파일을 같이 놓으면 확장자로 구분.
- 결과 표의 줄에 사진·데이터시트 칸 상태 표시(붙음 / 없음 / 오류 문구). "사진 없음" 안내는 ZIP 사진이 붙으면 사라진다.
- 프론트 검증: ZIP 은 확장자 `.zip`·50MB 이하만(`lib/validation/upload.ts` 에 종류 추가, 즉시 오류 문구, 서버가 같은 값을 다시 검사). 문구는 `messages/listing.ts`.
- 모바일(390px): 파일 선택 버튼 둘을 세로로.

### 영향 검토

- 단건 등록(`ListingService.create`)·업로드 API(`POST /uploads`)의 동작은 **안 바꾼다**. 검사 부분만 꺼내 재사용하므로 단건 테스트가 그대로 통과해야 한다.
- multipart 전역 상한 상승: 다른 업로드 API 도 최대 50MB 를 **받기 시작**한다 (거절은 서비스가 하지만 요청 본문은 임시 파일로 먼저 읽힌다). 서버 1대라 업로드 폭탄 위험이 커지는 감수. 운영 전 rate limit 재도입 때(보류 중, decisions 2026-10-19) 같이 다시 본다. 더 좁게 하려면 이 엔드포인트만 별도 상한을 두는 방법이 있으나 Spring MVC 에서 경로별 multipart 상한이 안 돼서 도입하지 않는다.
- 디스크: 사진·pdf 가 `parse` 시점에 저장돼 `usableSpace` 하한(10GB, 기존 `STORAGE_FULL`)을 파일마다 확인한다.
- 사진 없는 매물이 줄 수 있다(ZIP 사진이 붙으면). 목록·상세는 이미 null 허용.
- EXIF 위치 정보: 사진은 공개인데 EXIF 제거는 2단계(security.md 위험 항목). ZIP 로 사진이 대량으로 들어오므로 **운영 공개 전 EXIF 제거가 더 급해진다** — 이 PR 에선 하지 않고 문서의 위험 항목에 "다량 등록도 해당" 한 줄만 추가.
- 엑셀 대량구매(`CartBulk`)·견적 대량(`QuoteBulk`)은 안 건드린다.

## Global Constraints

- 문구는 `frontend/src/messages/` 에. 입력 검증 두 층(프론트 zod + 백엔드), 수치는 security.md 와 같게.
- 현재 사용자는 `@AuthenticationPrincipal` 만. 본문 userId 없음. 파일 이름·경로는 저장 경로에 **절대 쓰지 않는다**(키는 서버가 새로 발급 — `UploadKind.newKey`).
- 로그: 파일명·셀 값 금지(개인정보 아님이어도 줄 번호·사유 코드만).
- 새 API 파라미터 → `bruno/listings/bulk-parse.bru` 갱신. 정상·권한 없음·잘못된 입력 테스트.
- 인코딩 UTF-8, 한글 파일은 필요한 줄만 국소 수정. 저장소는 공개: 실제 주소·호스트 금지.

## 작업

- [ ] **1. `docs/decisions.md` 추가** — 2026-11-05 "사진은 엑셀로 못 올린다" 를 ZIP 선택 첨부로 부분 변경한 이유. 색인도 갱신. (docs 만이라 dev 직접 가능하지만 이 PR 과 같이 올림)
- [ ] **2. 업로드 검사 분리 (백엔드, 테스트 먼저)** — `UploadService.upload` 의 "종류·확장자·크기·매직바이트·디스크" 검사를 `InputStream`/바이트 기준 메서드로 꺼내 `upload(MultipartFile)` 와 ZIP 처리가 같이 쓰게. 단건 `UploadServiceTest` 가 그대로 통과해야 함.
- [ ] **3. ZIP 읽기** — 새 `ListingBulkArchive` (listing/service). 폴더·중첩·`../`·절대경로·파일 수·해제 총량·파일별 용량 검사. 읽으면서 센다. 한글 파일명(UTF-8, 깨지면 거절). 단위 테스트: 정상 / zip-slip / zip bomb(작은 압축본이 100MB 초과) / 중첩 ZIP / 폴더 / 이름 중복(대소문자만 다름).
- [ ] **4. 엑셀 칸 + 줄 연결** — `ListingBulkParser.HEADER_LABELS` 에 5칸(옛 양식 호환), `ListingBulkTemplate`, `BulkRowDto`(파일명·키), `BulkRowResult` 안내. `ListingBulkService.parse(userId, file, zip)`: 이름 매칭 → 저장 → 키 채움. `check`: 키가 있는지·종류 검사. `commit`: `claim` 후 `Listing` 에 키 저장(ZIP 우선, 없으면 마스터 사진). 테스트: ZIP 없음(기존 그대로) / 사진 붙음 / 이름이 ZIP 에 없음 / 종류 불일치 / 남의 키·만료 키 / 같은 파일명 두 줄.
- [ ] **5. 컨트롤러·설정** — `ListingBulkController.parse` 에 선택 파트 `attachments`, `application.yml` multipart 50MB/51MB, 413 처리(`GlobalExceptionHandler` 는 이미 `UPLOAD_TOO_LARGE`). API 테스트(MockMvc): 정상 / 비로그인 401 / 잘못된 ZIP 400 / 50MB 초과 413. `bruno/listings/bulk-parse.bru` 갱신.
- [ ] **6. 프론트** — `lib/api/listings.ts` parse 에 ZIP, `types/listingBulk.ts`, `lib/bulkListing.ts`(reducer 에 키 칸), `lib/validation/upload.ts`(zip 종류, Vitest), 모달 드롭존·줄 상태, `messages/listing.ts`. `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **7. 문서** — `security.md`(업로드 상한 표·"다량 등록 ZIP" 절·EXIF 한 줄), `design.md`(두 파일 칸 모양이 바뀌면), `data-model.md` 는 변경 없음.
- [ ] **8. 확인** — `./gradlew test --tests "*Bulk*" --tests "*Upload*"`, PR 직전 `./gradlew check`. E2E: 다량 등록 spec 에 ZIP 한 건 추가, 단계 실패만 조사. 실제 화면에서 엑셀만 / 엑셀+ZIP / 잘못된 ZIP 확인. 그 뒤 PR(대상 `dev`, 브랜치 `feat/bulk-listing-zip`) → `/code-review` 1회. 업로드 변경이므로 `/security-review` 도.

## Review Focus

- ZIP 처리 한계(zip bomb·zip-slip·읽는 중 용량 계산·중첩) 와 임시 파일 정리.
- `commit` 이 본문의 키를 `claim` 으로만 믿는지 (파일명·경로를 저장 경로에 안 쓰는지).
- 단건 업로드 검사 분리가 단건 동작을 안 바꿨는지.
- multipart 전역 상한 상승의 영향.
