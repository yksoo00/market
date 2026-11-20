# 사용자 식별자(uid) 형식 변경 + 날짜 저장 형식 통일 — 설계와 계획

사용자 지시(2026-11-19~20)로 두 가지를 바꾼다. 둘 다 저장 형식이 바뀌는 큰 작업이라 PR 을 나눈다.

## 설계

### 1. uid 를 `UP` + `yyMMdd` + 일련번호 3자리로 (예: `UP261008001`)
- 결정: `trd_user_info.uid` 를 `uuid` → `varchar(11)` 로 바꾼다. 컬럼 이름은 `uid` 그대로. 일련번호는 날짜가 바뀌면 `001` 부터 다시. 하루 999명을 넘으면 가입을 막고 오류를 낸다 (사용자: "하루 1000명 이상 안 할 것").
- 날짜 기준: 행을 만든 날(한국 시간, `KoreanDates`). 기존 사용자는 `reg_date`(없으면 `created_at`) 의 날짜 기준.
- uid 를 가리키는 컬럼도 같이 `varchar(11)`: `trd_prod_reg.user_id`, `trd_trade_info.user_id·seller_id`, `trd_cart_info.user_id·seller_id`, `trd_trade_history.user_id·seller_id·buyer_id`, 문의 `author_uid`, 그 밖에 uid 를 담는 컬럼 (작업 1 에서 `information_schema` 로 전수 조사).
- 코드: `UUID` 로 쓰던 사용자 키(백엔드 main 70개 파일·테스트 43개)를 `String` 으로. JWT subject, 리프레시 세션 Redis 키(`session:{userId}:{deviceId}`), `AuthenticatedUser`, 업로드·멱등성·문의·매물·거래·장바구니·조직 포함. 다른 UUID(문의 id, 기기 id, 파일 키 등)는 그대로.
- 번호 생성: `trd_user_info` 에서 오늘 날짜 접두사 `UP{yyMMdd}` 로 시작하는 uid 의 최댓값 + 1. 동시 가입 충돌은 `pg_advisory_xact_lock` 으로 줄 세운다 (매물 등록 잠금 `ProductRepository.lockCreation` 과 같은 방식). 라이브러리 추가 없음.
- 임시 테이블: 사용자 행 만들기·엑셀 가져오기에서 uid 값이 오든 안 오든 무시하고 항상 위 규칙으로 새로 만든다.
- 기존 행 변환: 마이그레이션이 사용자 행마다 새 uid 를 만들어 uid 를 가리키는 모든 컬럼을 같이 바꾼다. 외래키가 없는 테이블(2026-10-27 방침)이라 값 변환 쿼리로 처리.
- 감수: UUID 와 달리 추측 가능한 값이라, uid 가 주소에 노출되는 API(`/listings/{userId}/...`)는 소유자 검사에 의존한다. 이미 서버가 `@AuthenticationPrincipal` 로만 소유자를 판정하므로 새 위험은 없지만 `docs/security.md` 에 적는다.
- 대안: uuid 유지 + 별도 `user_code` 컬럼 — 영향 작지만 사용자 지시로 탈락(전체 키 변경).

### 2. 날짜 저장 형식 통일: 전부 숫자만
- 결정: `prov_date`(제공가능일), `req_deli_date`(납품희망일), `company_open_date`(개업일) 를 `yyyy-MM-dd`(10자) → `yyyyMMdd`(8자) 로 저장한다. 등록일시(`reg_date` 계열)는 이미 `yyyyMMddHHmmss` 라 그대로. 컬럼은 `varchar(10)` 유지(길이 변경 없음).
- 입력: 사용자가 `2026-10-10`, `2026.10.10`, `2026/10/10`, ` 2026-10-10 `, `20261010` 어떻게 넣어도 구분 문자(공백 `-` `.` `/` `:` `T`)를 지우고 숫자 8자리로 저장. 글자가 섞이거나 없는 날짜(2026-13-45)는 거절하고 필드 오류 문구. 일시(등록일시 계열)는 `2026-10-14 13:44`·`2026-03-03 11:11:11` 도 받아 14자리로: 8자리면 `000000`, 12자리면 `00` 을 붙인다.
- 적용 범위: 대량 등록·대량 구매 엑셀, 단건 폼(구매·견적·장바구니·매물 등록), 임시 테이블 폼·엑셀.
- 표시: API 응답은 `yyyyMMdd` 로 나가고, 화면(프론트)이 `2026-10-10` 로 포맷해 보여 준다. 임시 테이블 조회는 등록일시를 `2026-10-14 13:44` 형식으로 보여 준다.
- 파서: `common/time/KoreanDates` 에 `normalizeDate(String)`·`normalizeDateTime(String)` 을 추가하고 백엔드 입력 경로가 전부 이것을 쓴다. 프론트는 `lib/` 에 같은 규칙의 함수 하나(zod 검증에서 사용).
- 감수: 정의서가 `prov_date`·`req_deli_date` 를 `yyyy-MM-dd` 로 적었다면 정의서와 달라진다 — **사용자 결정(2026-11-20 "통일해")으로 둔다.** `docs/data-model.md` 에 차이로 적는다.

## 작업 (PR 3개, 순서대로. 모두 `dev` 대상, 머지는 사용자)

### PR 1 — 날짜 통일 (`feat/date-format-unify`, 스키마 변경은 `db/` 로 분리해 PR 1a)
1. `db/date-yyyymmdd`: 마이그레이션 — 세 컬럼 값을 `replace(col, '-', '')` 로 변환. 구버전 호환(배포 2회) 필요 여부 확인: 서버가 둘 다 읽는 중간 배포를 두고 읽기 쪽(백엔드가 `-` 있는 값도 `normalizeDate` 로 받음) 먼저, 변환 마이그레이션은 나중 → 지금 1인 개발·운영 전이라 1회로 한다(2026-10-27 방침과 같다).
2. `KoreanDates.normalizeDate/normalizeDateTime` + 단위 테스트(정상·공백·구분 문자·글자 섞임·없는 날짜·자릿수 부족).
3. 백엔드 입력 경로 교체: `TradeInputRules`, `TradeService`, `CartService`, `CartBulk*`, `Listing*`, `SignupService`, `DevTableService`. 응답·정렬·기간 필터(`TradeFilterRules`, `ListingSearchRepository`)가 8자리를 기준으로 하게. 각 테스트 갱신.
4. 프론트: `lib/validation/{trade,quote,cartAdd,buyBulk}.ts` 와 대량 엑셀 파싱이 구분 문자를 허용하고 8자리로 보냄, 화면은 `YYYY-MM-DD` 로 포맷하는 `formatDate()` 하나로. `*.test.ts` 갱신.
5. 임시 테이블: 날짜 컬럼 입력 정규화, 등록일시 조회 표시 `2026-10-14 13:44`.
6. `docs/data-model.md`·`decisions.md` 갱신.
- 검증: `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, 해당 E2E 1개.

### PR 2 — uid DB (`db/uid-varchar`)
1. 전수 조사: `uid` 를 담는 컬럼 목록 확정 (표로 보여 주고 이 파일에 적는다).
2. 마이그레이션: 컬럼 타입을 `varchar(11)` 로, 기존 사용자 새 uid 부여(`reg_date` 날짜별 001~), 참조 컬럼 값 변환. 인덱스·PK(매물 `user_id + reg_date` 등) 재생성. 되돌리기 쓰기.
3. 빈 DB 와 데이터가 있는 DB 둘 다에서 마이그레이션 테스트(Testcontainers).

### PR 3 — uid 코드 (`feat/uid-format`) — PR 2 머지 후
1. 번호 생성 서비스(advisory lock) + 동시 가입 테스트(스레드 N개 → 중복 없음, 999 초과 오류).
2. `UUID userId` → `String` 전환, 컴파일 오류를 따라 70개 파일 정리. JWT·세션·`AuthenticatedUser`·업로드·멱등성·도메인 엔티티.
3. 임시 테이블: uid 값 무시하고 항상 새 번호.
4. 프론트의 uuid 형식 가정 제거(`uuid.test.ts` 등), uid 를 표시하는 곳 확인.
5. `docs/security.md`·`data-model.md`·`decisions.md` 갱신, bruno 요청 갱신.
- 검증: `./gradlew check` 전체, 프론트 3종, E2E 가입→로그인→등록 흐름. `/security-review` 필수(인증·토큰·세션 변경).

## 열린 항목
- PR 3 전에 PR 2 를 먼저 배포할 수 없다(코드와 스키마가 서로 맞아야 함) — 운영 전 단일 배포로 PR 2·3 을 같이 올린다. 중간 `dev` 는 일시적으로 깨지지 않도록 PR 2 와 3 을 같은 배포 단위로 묶는다.
- 위 감수·가정 중 틀린 것이 있으면 구현 전에 말해 달라.
