# 데이터 모델

> 현재 계정 데이터는 `users` 한 테이블에 둔다. 다른 계정 테이블은 사용하지 않는다.
> 제품의 매물·채팅·거래 스키마는 PRD 작성 후 정의한다.

## 계정: `users`

단일 계정 테이블은 `V202609281200__replace_user_account_model.sql`에서 생성한다. 마이그레이션은 기존 계정 테이블과 데이터를 제거하므로 개발 DB를 초기화한 뒤 적용한다.

| 컬럼 | 타입 | 용도 |
|---|---|---|
| `id` | uuid | 내부 사용자 ID, PK |
| `user_id` | varchar(20) | 개인 로그인 ID. 기업 행은 사업자번호를 같이 둔다 |
| `password` | varchar(200) | bcrypt 비밀번호 해시 |
| `user_class` | varchar(10) | `personal` 또는 `business` |
| `user_name` | varchar(50) | 개인 이름 또는 기업 담당자 이름 |
| `user_phone`, `user_tel` | varchar(20) | 휴대전화·전화번호 |
| `user_email` | varchar(100) | 이메일 |
| `user_address` | varchar(200) | 사용자 주소 |
| `bus_reg_id` | varchar(20) | 기업 사업자등록번호 |
| `company_type` | varchar(10) | `corporate` 또는 `individual` (`corporation` UI 값은 저장 시 `corporate`로 변환) |
| `company_name` | varchar(50) | 회사명 |
| `company_open_date` | varchar(10) | 개업일 |
| `company_tel` | varchar(20) | 회사 전화번호 |
| `company_address` | varchar(200) | 회사 주소 |
| `dt_reg`, `dt_update`, `dt_expire` | varchar(14) | 등록·갱신·만료 시각 (`yyyyMMddHHmmss`) |
| `user_nickname` | varchar(100) | 별칭 |
| `nickname_usage` | varchar(1) | `Y`면 별칭 사용, 아니면 이름/회사명을 표시 |
| `contact_method` | varchar(1) | 연락 수단 (`1` 전체, `2` 전화, `3` 이메일) |
| `spare_col` | varchar(40) | 예비 컬럼. 현재 가입 흐름에서는 사용하지 않음 |
| `role`, `status`, `must_change_password`, `deleted_at` | 운영 컬럼 | 권한·계정상태·초기 비밀번호 변경·탈퇴 처리를 위해 추가 |

인덱스: 활성 `user_id` 유일, 기업 `bus_reg_id` 유일, 활성 이메일·전화번호·사용 별칭 유일, `(user_class, status)` 조회 인덱스.

### 저장 규칙

- 비밀번호는 bcrypt 해시만 저장한다.
- 개인 로그인은 `user_id`, 기업 로그인은 `bus_reg_id`로 한 행을 조회한다.
- 개인은 `nickname_usage='Y'`일 때 `user_nickname`, 아니면 `user_id`를 표시한다. 기업은 `company_name`을 표시한다.
- 기업 정보는 해당 기업 사용자의 같은 행에 저장한다. `organizations`와 `organization_members`는 사용하지 않는다.
- 개인 가입은 약관·본인인증 단계 없이 사용자 입력값을 저장한다. 동의 이력은 현재 수집하지 않으므로 운영 공개 전 별도 동의 절차가 필요하다.
- 현재 제공된 컬럼 길이대로 이름·전화·이메일 등은 일반 문자열로 저장된다. 컬럼 암호화가 필요하면 길이와 저장 형식을 포함해 스키마를 다시 정해야 한다.
- CI/DI를 저장하지 않으므로 본인인증 기준의 재가입 차단은 없다.
- 소셜 로그인은 일시 비활성(코드 주석 처리)이며 소셜 계정 테이블을 두지 않는다. 재활성화 시 저장 방식을 다시 정한다.

## 나머지 데이터

매물·채팅·거래 테이블은 아직 정의하지 않았다. 기능 범위와 역할을 정한 뒤 별도 모델과 Flyway 마이그레이션으로 추가한다.
