# 데이터 모델

> 이 문서가 답하는 질문: 어떤 데이터를 어디에(Postgres·Redis·MinIO) 어떤 모양으로 저장하나.
> 마이그레이션 규칙은 `.claude/rules/db.md`. 스키마를 바꾸면 이 문서를 같은 커밋에서 갱신한다.
> 표기: `PK` 기본키, `FK→` 외래키, `U` 유일, `U*` 유일(삭제 안 된 행만, 부분 인덱스), `?` nullable.

## 공통

- 모든 테이블: `id uuid PK default gen_random_uuid()`, `created_at`·`updated_at timestamptz not null`.
- soft delete 대상: `deleted_at timestamptz ?` + 조회는 항상 `where deleted_at is null`. 유일 제약은 부분 인덱스로 (탈퇴 후 같은 아이디·이메일로 재가입 가능).
- 열거형은 Postgres enum 대신 `text` + `check` 제약 (값 추가가 무중단 배포와 맞음).
- 개인정보(이름·휴대폰·이메일·CI)는 API 응답·로그·챗봇에 노출 금지 (`security.md`). 이 문서에서 **PII** 표시.

---

## 1. 계정 (인증 구현용 — 2026-09-21 초안)

> 구현: `V202609211800`~`1805` (테이블당 파일 하나), 엔티티 `user/domain`·`organization/domain`, 암호화 `common/crypto/PiiConverter`. 열거형은 Java enum ↔ 소문자 text 컨버터(`LowerCaseEnumConverter`, enum 안의 `Db` 중첩 클래스).

### 한눈에

```
users ──1:N── social_accounts        소셜 로그인 (카카오·네이버·구글)
  │  ──1:1── identity_verifications  본인인증 결과 (CI/DI). 일반 회원만
  │  ──1:N── terms_agreements        약관 동의 기록
  └──1:N── organization_members ──N:1── organizations   기업 (심사 상태, 사업자 정보)

Redis: refresh 세션, 가입 진행 토큰, 비밀번호 재설정 토큰, 로그인 실패 카운터
MinIO: 사업자등록증 파일 (organizations.license_file_key)
```

계정은 **`users` 한 행 = 로그인 주체 하나**. 일반(아이디·소셜)과 기업(담당자)이 같은 테이블이고 `kind`로 구분. 기업의 사업자 정보는 `organizations`에 있고, 기업 로그인(사업자번호 + 비밀번호)은 `organizations.biz_no → organization_members(owner) → users.password_hash` 순으로 찾는다.

### users

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| kind | text | not null, check in (`personal`, `business`) | 기업은 담당자 계정. 화면 표시명은 personal=닉네임, business=기업명 |
| role | text | not null, check in (`user`, `admin`), default `user` | 관리자는 화면에서 가입 불가, 시드로만 (`security.md`) |
| status | text | not null, check in (`active`, `suspended`, `withdrawn`), default `active` | suspended=이용 정지(관리자), withdrawn=탈퇴(soft delete와 같이) |
| login_id | text ? | U*, 영문 소문자·숫자 5~20 | personal 아이디 로그인만. 소셜·기업은 null. 변경 불가 |
| password_hash | text ? | | bcrypt cost 12. personal(아이디)·business 는 not null, 소셜만 null — 앱에서 검사 |
| nickname | text | not null, 2~20(personal)·2~50(business), U* personal 만 | personal 표시명. business 는 기업명 (같은 상호 허용) |
| email | text ? | U*, ≤254 | **PII**. personal 필수, 소셜은 제공 시, business 는 담당자 이메일(비밀번호 재설정) |
| email_verified_at | timestamptz ? | | 소셜이 미검증으로 주면 null (`security.md`) |
| name | text ? | 암호화 | **PII**. personal=본인인증 이름, business=담당자명. 2~30 (암호화 전). 화면 노출 금지 |
| phone | text ? | 암호화 | **PII**. personal=본인인증 번호, business=담당자 휴대폰. 숫자만 10~11 (암호화 전) |
| phone_hash | text ? | U* | HMAC-SHA256(phone). 중복 가입 검사용 (암호화 컬럼은 검색 불가). 키 없는 sha256 은 휴대폰(경우의 수 ~10^8)을 역산할 수 있어 키 있는 해시 |
| marketing_opt_in_at | timestamptz ? | | 마케팅 수신 동의 시각. null=미동의. 철회 시 null |
| last_login_at | timestamptz ? | | |
| must_change_password | boolean | not null, default false | 시드 관리자·관리자가 초기화한 비밀번호. true 면 로그인 직후 변경 화면으로 |
| created_at, updated_at | timestamptz | not null | |
| deleted_at | timestamptz ? | | 탈퇴. 아래 "탈퇴 처리" |

인덱스: `U* (login_id)`, `U* (nickname) where kind = 'personal'`, `U* (lower(email))` (대소문자만 다른 이메일은 같은 계정), `U* (phone_hash)`, `(kind, status)`.
제약: `check ((status = 'withdrawn') = (deleted_at is not null))` — 탈퇴 상태와 deleted_at 이 따로 놀 수 없게.

### social_accounts

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK→users, not null | |
| provider | text | not null, check in (`kakao`, `naver`, `google`) | |
| provider_user_id | text | not null | 제공자의 회원 고유번호. **PII 아님**이지만 노출 불필요 |
| provider_email | text ? | 암호화 | **PII**. 제공자가 준 이메일. users.email 과 별도 보관 (사용자가 users.email 을 바꿔도 대조용) |
| connected_at | timestamptz | not null | 처음 연결한 시각 |
| created_at, updated_at | timestamptz | not null | 재연결·이메일 갱신 시 updated_at |

인덱스: `U (provider, provider_user_id)`, `U (user_id)`. **계정당 소셜 연결 하나** — 카카오로 가입했으면 네이버 추가 연결 불가 (decisions.md 2026-09-22).

### identity_verifications — 휴대폰 본인인증 결과

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK→users, not null, U | 일반 회원 1:1 |
| provider | text | not null, check in (`pass`, `nice`, `stub`) | `stub` 은 개발용. 운영에서 거부 |
| ci | text | not null, 암호화 | **PII**. 연계정보 88자 |
| ci_hash | text | not null, U | HMAC-SHA256(ci). **한 사람 = 계정 하나** 를 이 유일 제약이 보장. 찾기 조회도 이 컬럼 |
| di | text | not null, 암호화 | **PII**. 중복가입확인정보 |
| verified_at | timestamptz | not null | 마지막 인증 시각. 재인증(휴대폰 변경 등) 시 갱신 |
| created_at, updated_at | timestamptz | not null | |

- 이름·휴대폰은 `users`에 (여기 중복 저장 안 함). 생년월일·성별은 받지 않음 (수집 최소화).
- 가입 **전** 인증 결과는 DB 가 아니라 Redis `signup:verify:{token}` (30분)에. 가입 완료 시 이 테이블로.
- 아이디·비밀번호 찾기: 인증 결과 CI 의 해시로 `ci_hash` 조회 → user_id.
- 탈퇴 시 행 **하드 삭제** (개인정보 즉시 파기. `deleted_at` 규칙의 예외 — 법적 파기 의무). 재가입 제한 없음 (결정 2).

### terms_agreements — 약관 동의 기록

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK→users, not null | |
| terms_id | text | not null, check in (`service`, `privacy`, `age`, `marketing`, `business`) | `frontend/src/messages/terms.ts` 의 id 와 같음 |
| version | text | not null | 약관 시행일 `YYYY-MM-DD`. 문안이 바뀌면 새 버전으로 재동의 |
| agreed | boolean | not null | 선택 항목 미동의도 기록 (거부 사실 증빙) |
| agreed_at | timestamptz | not null | |
| ip | inet ? | | 동의 증빙용. 90일 후 null 처리 (접속 기록 보관 기간과 동일) |
| created_at, updated_at | timestamptz | not null | 동의 기록은 수정하지 않음(철회는 새 행). updated_at 은 ip null 처리 때만 |

인덱스: `(user_id, terms_id)`. 유일 제약 없음 — 같은 버전에 동의 → 철회(agreed=false)가 새 행으로 쌓이고 현재 상태는 agreed_at 최신 행. 탈퇴해도 삭제하지 않음 (동의 증빙 5년 — 전자상거래법 기록 보관과 같이).

### organizations — 사업자

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| biz_no | text | not null, U*, 숫자 10 | 사업자등록번호. **사업자번호당 계정 1개** (`decisions.md`) |
| name | text | not null, 2~50 | 상호(기업명) |
| owner_name | text | not null, 2~50 | 대표자. 국세청 진위확인 입력값 |
| start_date | date | not null | 개업년월일 |
| biz_type | text | not null, check in (`corporation`, `individual`) | 법인 / 개인사업자 |
| address | text | not null, ≤200 | 사업장 주소 |
| license_file_key | text ? | | MinIO 키 (`business-licenses/{org_id}/{uuid}.pdf`). URL 저장 금지. 승인 후 90일 뒤 파일 삭제·null |
| nts_verified_at | timestamptz ? | | 국세청 진위확인 통과 시각. `stub` 인증은 null 로 두고 운영에서 가입 거부 |
| review_status | text | not null, check in (`pending`, `approved`, `rejected`), default `pending` | 관리자 심사 (`decisions.md` 2026-09-21) |
| reviewed_at | timestamptz ? | | |
| reviewed_by | uuid ? | FK→users | 심사한 관리자 |
| reject_reason | text ? | ≤500 | rejected 일 때 담당자에게 보내는 사유 |
| created_at, updated_at | timestamptz | not null | |
| deleted_at | timestamptz ? | | |

인덱스: `U* (biz_no)`, `(review_status)`, `(reviewed_by)`.
제약: `check (review_status = 'pending' or reviewed_at is not null)`, `check (review_status <> 'rejected' or reject_reason is not null)` — 심사 결과 없이 approved/rejected 불가.

- `approved` 일 때만 사업자 배지·사업자 명의 매물 (`listings.seller_org_id`) 가능. 그 전엔 담당자 계정이 일반 회원처럼만.
- 사업자번호 선점 분쟁(이의 신청)은 관리자 화면에서 `organization_members` 의 owner 를 바꾸는 것으로 처리. 절차는 `roles.md` 에서.

### organization_members

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| organization_id | uuid | FK→organizations, not null | |
| user_id | uuid | FK→users, not null | kind=business 인 사용자 |
| role | text | not null, check in (`owner`, `member`), default `owner` | 1단계는 owner 1명. member 는 2단계(사용자 초대) |
| created_at, updated_at | timestamptz | not null | 담당자 변경(owner 교체)·role 변경 시 updated_at |

인덱스: `U (organization_id, user_id)`, `U (organization_id) where role = 'owner'` (owner 는 하나), `U (user_id)` (한 사람은 한 조직만).

### Redis 키 (계정 관련)

| 키 | 값 | TTL | 용도 |
|---|---|---|---|
| `session:{user_id}:{device_id}` | refresh 토큰 해시 | 30일 | `security.md` 인증 |
| `signup:verify:{token}` | 본인인증 결과(ci, di, name, phone, provider) | 30분 | 가입 전 인증 결과. 가입 완료 시 삭제 |
| `signup:biz:{token}` | 사업자 인증 결과(biz_no, start_date, owner_name, nts_result) | 30분 | 기업 가입 1→2단계 |
| `oauth:state:{state}` | OAuth 인가 요청(client_id, redirect_uri, scope, nonce, next, oauth_flow 쿠키 해시) | 10분 | 세션이 없어 state 검증을 Redis 로. api-1 에서 시작한 로그인의 콜백이 api-2 로 와도 됨 |
| `signup:oauth:{token}` | 소셜 프로필(provider, provider_user_id, email, email_verified, name) + oauth_flow 쿠키 해시 | 10분 | 소셜 첫 로그인 → `/signup/social`. 가입 완료 시 삭제 |
| `pwreset:{token_hash}` | user_id | 30분, 1회용 | 기업 비밀번호 재설정 링크 |
| `login:fail:user:{login_id or biz_no}` | 실패 횟수 | 10분 | 5회 → `login:lock:{…}` 15분 |
| `login:fail:ip:{ip}` | 실패 횟수 | 10분 | 30회 |
| `signup:ip:{ip}` | 가입 시도 횟수 | 1시간 | 5회 |
| `signup:check:ip:{ip}` | 중복확인 호출 횟수 | 1분 | 30회 |

### 흐름별 쓰기

| 흐름 | 쓰는 곳 |
|---|---|
| 일반 가입 | users(kind=personal, login_id, password_hash, name, phone ← Redis verify) + identity_verifications + terms_agreements ×4 |
| 소셜 첫 로그인 | users(kind=personal, login_id·password null, name·phone null) + social_accounts + terms_agreements ×4 |
| 기업 가입 | users(kind=business, name·phone·email=담당자, nickname=기업명) + organizations(pending) + organization_members(owner) + terms_agreements ×4 |
| 기업 승인 | organizations.review_status·reviewed_at·reviewed_by |
| 담당자 변경 (1단계 고객센터 수동) | 새 담당자 users 행 생성 → organization_members.user_id 를 새 사용자로 교체(owner 유일 제약 유지) → 이전 담당자 users 는 탈퇴 처리. 이전 담당자 정보는 남기지 않음 (PII) |
| 탈퇴 | 아래 |

### 탈퇴 처리 (`security.md` 개인정보)

`users`: `status=withdrawn`, `deleted_at=now()`, `nickname='탈퇴한 사용자'`, `email=sha256(email)`(중복 검사용 해시만), `login_id=null`, `name=null`, `phone=null`, `phone_hash=null`, `password_hash=null`, `marketing_opt_in_at=null`.
`social_accounts`: 하드 삭제. `identity_verifications`: 하드 삭제. `terms_agreements`: 유지. `organizations`: owner 탈퇴 시 `deleted_at` 같이 (1단계는 owner=기업).
매물·채팅은 상대방 보호를 위해 익명화 상태로 유지 (해당 절에서).

---

## 결정 (2026-09-21, `decisions.md` 에도 기록)

1. **관리자 시드**: 앱 시작 시 `role=admin` 이 없으면 `ADMIN_LOGIN_ID`/`ADMIN_PASSWORD` 환경변수로 1명 생성. `users.must_change_password=true` 로 첫 로그인 후 비밀번호 변경 강제. 마이그레이션에 해시를 넣지 않는다.
2. **탈퇴 후 재가입 제한 없음**: `identity_verifications` 하드 삭제로 끝. CI 해시 보관 테이블 없음. 악용 사례가 생기면 30일 제한 재검토.
3. **닉네임 유일은 personal 만**: `U* (nickname) where kind = 'personal'`. business 는 기업명을 그대로 (같은 상호 허용).
4. **이름·휴대폰 컬럼 암호화**: `users.name`, `users.phone`, `social_accounts.provider_email`, `identity_verifications.ci/di` 는 AES-256-GCM 으로 암호화해 저장. 키는 `.env` `PII_ENCRYPTION_KEY`(32바이트 base64). Spring JPA `AttributeConverter` 한 개(`common/crypto`). 암호화 컬럼은 `=` 검색 불가 → CI 조회는 별도 `ci_hash` 컬럼으로, 휴대폰 중복 검사는 `phone_hash`. 해시는 **HMAC-SHA256**(`common/crypto/PiiHasher`), 키는 암호화 키에서 파생 — 키 없는 sha256 은 휴대폰을 DB 유출 시 바로 역산. 해시는 서비스 계층이 계산해 엔티티에 넘긴다.

## 2. 매물 — 레거시 스펙 초안 (`prd.md` 전, 재검토 예정)

> 구현: `V202609291000__create_product_listing_tables.sql`. 사용자가 제공한 레거시 테이블 정의(TRD_PROD_MASTER, TRD_REG_INFO)를 그대로 옮긴 것. PRD 확정 전 초안이라 카테고리 마스터·이미지 구조(고정 컬럼 vs 별도 테이블)·상태값 체계(자유텍스트 vs enum)는 다시 바뀔 수 있다. 채팅·거래 스키마는 아직 없다.

### products (TRD_PROD_MASTER — 상품마스터)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| prod_id | varchar(20) | PK | 레거시 비즈니스 키를 그대로 PK로 씀 (uuid 서로게이트 없음, 2026-09-29 지시). 자동생성: 카테고리(8)+일련번호(4) |
| category_code | varchar(10) | not null | 카테고리마스터 참조 값이나, 카테고리마스터 테이블은 아직 없음 |
| prod_name | varchar(50) | not null | |
| prod_no | varchar(20) | | 제조사 번호(코드) |
| prod_brand | varchar(50) | not null | |
| prod_mufc_date | varchar(14) | | 제조일시 |
| prod_spec_info | varchar(100) | | 제조사 제공 자유 기재 |
| prod_data_sheet | varchar(100) | | 경로정보 |
| prod_photo_1 | varchar(100) | | 경로정보. 파일 저장소 미정(decisions.md 2026-09-28) 이라 지금은 경로 컬럼만 |
| reg_date | varchar(14) | not null | 등록일시 |
| spare_col | varchar(100) | | 예비 컬럼 |

### listings (TRD_REG_INFO — 상품등록 정보)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| user_id | uuid | PK(복합), FK→users | 레거시 "사용자ID". 로그인 아이디 문자열이 아니라 users.id(uuid). 조직(seller_org_id)은 넣지 않음 — decisions.md 미정 항목을 이 커밋에서 확정 |
| reg_date | varchar(14) | PK(복합), not null | 등록일시(일시분초). user_id 와 복합 PK — 같은 사용자가 같은 초에 두 번 등록하면 충돌(레거시 설계 그대로, 재검토 예정) |
| prod_id | varchar(20) | not null, FK→products(prod_id) | |
| trade_type | varchar(20) | not null | 거래종류 (등록) |
| prod_state | varchar(20) | not null | 상품상태 (레거시: "신품대비 00%" 자유 텍스트) |
| sales_unit_price | integer | not null | 등록단가 |
| sales_quantity | integer | not null | 등록수량 |
| min_order_quantity | integer | not null, default 1 | |
| order_unit | integer | not null, default 1 | |
| delivery_date | varchar(10) | | 납기일(제공가능일). **레거시 스펙엔 물리명이 REG_DATE 로 등록일시와 중복 기재되어 있어 분리함** |
| stock_quantity | integer ? | | 재고수량. 레거시 기본값 "판매수량"은 DB default로 표현 불가해 앱에서 채움 |
| prod_description | varchar(200) | | |
| prod_data_sheet | varchar(100) | | |
| prod_photo_1~3 | varchar(100) | | 경로정보 |
| prod_image_4 | varchar(100) | | 경로정보. 레거시 물리명이 다른 사진 컬럼과 다름(PROD_IMAGE_4) — 그대로 유지 |
| warranty_period | integer ? | | 보증기한(일) |
| warranty_coverage | varchar(10) | | 불량지원방법 (대체/환불) |
| replace_prod | varchar(100) | | 대체품 경로정보 |
| test_report | varchar(100) | | 경로정보 |
| certificate_of_authen | varchar(100) | | 정품인증서 경로정보 |
| dt_update | varchar(14) | | 최종갱신일시 |
| dt_expire | varchar(14) | | 거래완료일시 |
| spare_col | varchar(100) | | |

인덱스: `(prod_id)` on listings (FK 조회용).

**다음에 정할 것**: PRD 작성 시 카테고리 마스터 테이블 여부, 이미지 다건 구조(별도 테이블) 전환, prod_state enum화, 조직(seller_org_id) 도입 여부, (user_id, reg_date) 복합키 충돌 가능성, quantity·가격 검증 규칙(`security.md`).
