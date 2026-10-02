# 파일 업로드 설계 (백엔드)

> 2026-10-02. 브레인스토밍에서 사용자와 합의한 내용. 상품등록 직접 입력 화면(프론트)은 이 기능 다음 PR.

## 목적

매물 사진·데이터시트·테스트리포트·정품인증서·대체품 파일을 서버 디스크에 저장하고, 매물 등록·수정 API가 그 파일을 참조하게 한다. 지금 `listings`·`products`의 경로 컬럼은 아무 문자열이나 받는다 — 실제로 올린 파일만, 올린 본인만 쓸 수 있게 바꾼다.

## 범위

- 포함: 저장소(`common/storage`), 업로드 API, 파일 열람 API, 매물 등록·수정 API의 키 검사, 설정(Compose volume·환경변수), 문서, Bruno, 테스트.
- 제외 (다음 작업):
  - 프론트 화면 — 다음 PR(등록 폼 + 파일 칸).
  - 이미지 리사이즈·EXIF 제거 — security.md 기존 결정대로 2단계. 아래 "위험" 참고.
  - 고아 파일 정리(올리고 등록 안 한 파일) — 당분간 수동.
  - 매물 삭제 시 파일 삭제 — 상품 대표 사진(`products.prod_photo_1`)이 첫 매물 사진 키를 공유하므로 DB 행만 지운다.
  - 사업자등록증·엑셀·PDF 등록 원본 업로드.

## 결정

- **저장소는 서버 로컬 디스크.** MinIO 안 씀. 서버 1대라 MinIO의 장점(여러 서버 공유, S3 API, 서명 URL)이 필요 없고, 컨테이너 하나를 더 운영해야 한다 (09-28에 MinIO 이미지를 못 받아 Compose가 막힌 이력). 코드는 `FileStorage` 인터페이스만 거치게 해 나중에 교체 가능. 재검토 조건: 서버 2대 이상, 대용량 직접 업로드(서명 URL), CDN 필요. `decisions.md`에 기록.
- **Docker volume에 저장.** api-1·api-2가 같은 volume(`uploads_data`)을 마운트. 프로세스 메모리가 아니라 공유 디스크라 stateless 규칙과 맞다. volume은 DB와 함께 백업 대상.
- **폴더는 구조별로 나눈다.** `public`/`private` → 도메인 → 종류 → `yyyy/MM` → `<uuid>.<확장자>`. 1단에서 공개·비공개를 갈라 전달 코드가 실수로 비공개 파일을 내주지 않게 한다. `yyyy/MM`은 디렉터리 크기 제한과 백업·정리 단위. 매물별 폴더는 안 됨 — 업로드가 등록보다 먼저라 매물 키를 모른다.
- **2단계 업로드.** 파일을 고르는 즉시 업로드 → 서버가 저장소 키 반환 → 매물 등록·수정 요청(JSON)에 키를 담는다. 기존 등록 API 모양·Bruno가 그대로이고, 수정(PATCH)도 같은 업로드 API를 쓴다. 대안이었던 multipart 한 번 등록은 기존 API를 바꾸고 실패 시 전부 재전송이라 탈락.
- **용도(`kind`)로 받는다, 형식으로 받지 않는다.** 같은 PDF라도 용도마다 폴더·열람 권한이 다르다. 형식은 서버가 파일 내용(매직 바이트)으로 판단한다.
- **데이터시트·테스트리포트·정품인증서·대체품은 로그인 사용자만 열람** (사용자 지시). 사진만 공개.
- **DB에는 저장소 키만.** URL이 아니다 (09-28 결정 유지). 스키마 변경 없음.

## 업로드 용도

| `kind` | 폴더 | 형식 | 크기 | 열람 | 들어가는 필드 |
|---|---|---|---|---|---|
| `listing-photo` | `public/listings/photos/` | jpg·png·webp | 5MB | 누구나 | `photos` (최대 4) |
| `listing-datasheet` | `private/listings/datasheets/` | pdf | 10MB | 로그인 | `listingDataSheet`, `productDataSheet` |
| `listing-test-report` | `private/listings/test-reports/` | pdf·jpg·png | 10MB | 로그인 | `testReport` |
| `listing-certificate` | `private/listings/certificates/` | pdf·jpg·png | 10MB | 로그인 | `certificateOfAuthen` |
| `listing-replace-prod` | `private/listings/replace-prods/` | pdf·jpg·png | 10MB | 로그인 | `replaceProd` |

키 예: `private/listings/replace-prods/2026/10/3f2a…-….pdf` — 가장 긴 폴더 기준 80자, 컬럼 상한 100자 안. 확장자는 소문자, `jpeg`는 `jpg`로 저장. 연·월은 앱 `Clock` 기준.

## 저장 (`common/storage`)

- `FileStorage` 인터페이스: 저장(스트림 → 키), 읽기(키 → 리소스). `LocalFileStorage`가 구현.
- 루트: `app.storage.root` ← 환경변수 `STORAGE_ROOT`. 로컬 기본값은 `backend/` 아래 git 무시 디렉터리, Compose는 volume 마운트 경로.
- 경로 탈출 방지: 키를 루트 기준으로 풀고 정규화한 뒤 루트 밖이면 거부. 키 형식도 정규식으로 먼저 검사 (`(public|private)/listings/<종류>/yyyy/MM/<uuid>.<확장자>`).
- 같은 디렉터리의 임시 파일에 다 쓴 뒤 최종 이름으로 이동. 쓰다 끊긴 파일이 키로 노출되지 않는다.

## API

### `POST /api/v1/uploads` (multipart: `kind`, `file`)

- 로그인 필수 (비로그인 401). rate limit 20회/10분/사용자 (security.md 수치).
- 검사 순서: `kind` 값 → 확장자 허용 여부 → 크기 → 매직 바이트(jpg `FF D8 FF`, png `89 50 4E 47`, webp `RIFF....WEBP`, pdf `%PDF-`). 확장자와 내용이 다르면 거부. Content-Type 헤더는 안 믿는다.
- 성공 201 `{ ok: true, data: { key } }`.
- Redis `upload:<key>` = `<userId>|<kind>`, TTL 24시간.
- 실패:
  - 잘못된 `kind` → 400 `VALIDATION`, `fields.kind`
  - 형식 → 400 `UPLOAD_INVALID_TYPE`
  - 크기(용도별 상한 또는 Spring multipart 상한 10MB) → 413 `UPLOAD_TOO_LARGE`
- 새 오류 코드는 프론트 `messages/upload.ts`에 같은 PR로 문구 추가.

### `GET /api/v1/files/{key}`

- `public/…` → 누구나 200.
- `private/listings/…` → 로그인 200, 비로그인 401.
- 그 외 경로·없는 파일·탈출 시도 → 404.
- 헤더: Content-Type은 확장자로, `X-Content-Type-Options: nosniff`, PDF는 `Content-Disposition: inline`. 공개 파일은 키가 UUID라 내용이 안 바뀜 → `Cache-Control: public, max-age=31536000, immutable`. 비공개는 `private, no-cache`.

### 매물 등록·수정의 키 검사

- 대상 필드:
  - 등록 `POST /api/v1/listings`: `photos`, `listingDataSheet`, `productDataSheet`
  - 수정 `PATCH /api/v1/listings/{userId}/{regDate}`: `photos`, `listingDataSheet`, `testReport`, `certificateOfAuthen`, `replaceProd`
- 요청 모양(필드 이름·길이 상한)은 그대로. 값 검사만 추가: 각 키가 Redis `upload:<key>`에 있고, 올린 사람 = 요청자, 용도가 필드와 맞아야 한다.
- 실패 → 400 `VALIDATION`, 해당 필드에 "파일을 다시 올려 주세요." 프론트가 그 칸에 표시.
- 같은 키를 두 필드에 넣는 것(예: 상품·매물 데이터시트)은 허용, 한 번만 확인.
- 수정 시 그 매물에 **이미 저장된 키**는 Redis 확인 없이 통과 — 사진 1장만 바꿔도 나머지를 다시 올리지 않는다.
- 순서: 키 확인(기록 유지) → DB 저장 → 저장 성공 후 Redis 기록 삭제. 같은 업로드를 다른 매물에 재사용 불가. DB 저장이 실패하면 기록이 남아 재시도 가능.
- 키 확인은 `common/storage`의 서비스가 맡고 `listing` 서비스가 호출한다 (도메인 간 repository 직접 접근 금지 규칙).

## 위험

- **EXIF 위치 정보.** 휴대폰 사진에는 촬영 위치(GPS)가 들어 있을 수 있고 사진은 공개다. EXIF 제거(2단계) 전에 운영 공개하면 판매자 위치가 노출될 수 있다. security.md에 명시.
- **고아 파일.** 올리고 등록하지 않은 파일은 디스크에 남는다. 지금은 수동 정리. 쌓이면 Redis 기록 만료 후 DB에 없는 파일을 지우는 정리 작업을 만든다.
- **비공개 파일 링크와 쿠키.** 프론트(app.)와 API(api.)가 다른 서브도메인이라, PDF 링크를 새 탭으로 열 때 로그인 쿠키가 실리는지 프론트 PR에서 확인한다 (쿠키는 루트 도메인 공유, 09-17 인증 결정).

## 테스트

- `LocalFileStorage` 단위 (`@TempDir`): 저장·읽기, `../`·절대 경로·형식 안 맞는 키 거부, 임시 파일이 남지 않음.
- 형식 검사 단위: 용도별 허용·거부, 확장자 위장(`.jpg`인데 PDF 내용) 거부, 빈 파일 거부.
- 업로드 API 통합: 정상 201 + Redis 기록, 비로그인 401, 잘못된 kind 400, 잘못된 형식 400, 크기 초과 413, rate limit 429.
- 열람 API 통합: 공개 사진 비로그인 200, 비공개 비로그인 401·로그인 200, 없는 키·탈출 경로 404, 응답 헤더.
- 매물 등록·수정: 정상 키 저장 후 Redis 기록 삭제, 남의 키 거부, 용도 다른 키 거부, 이미 쓴 키 재사용 거부, 수정 시 기존 키 통과.
- 기존 매물 테스트·`bruno/listings/`의 임의 문자열 경로를 업로드 키 방식으로 고친다.

## 문서·설정

- `decisions.md`: 로컬 디스크 저장소(09-28 항목에 `[대체됨]` 표시), 폴더 구조, 2단계 업로드, 비공개 파일 로그인 열람. 색인 갱신.
- `security.md` "파일 업로드": 용도 표로 교체, 사진 최대 4장(기존 문서 10장 — DB 컬럼 4개에 맞춤), EXIF 위험, 비공개 열람 규칙.
- `architecture.md`: 저장소 volume. `data-model.md`: 경로 컬럼 = 저장소 키.
- `docker-compose.yml` volume `uploads_data`, `.env.example` `STORAGE_ROOT`, `application.yml` (`app.storage.root`, `spring.servlet.multipart` 상한), `.gitignore` 로컬 저장 디렉터리.
- Bruno `bruno/uploads/` (업로드·열람).

## 브랜치

`feat/file-upload` 하나. DB 스키마 변경이 없어 `db/` 브랜치 불필요. 의존성 추가 없음 (Spring 기본 multipart·`java.nio.file`).
