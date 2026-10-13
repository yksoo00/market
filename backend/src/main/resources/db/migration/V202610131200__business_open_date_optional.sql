-- 기업 행의 개업년월일(company_open_date)을 필수에서 뺀다. 사용자 제공 users 표에서 이 컬럼은 필수가 아니고,
-- 기업 가입이 사업자번호만으로 조회하게 바뀌어 개업일을 받지 않는다 (decisions.md 2026-10-13).
-- 제약을 푸는 것뿐이라 직전 배포 버전 코드(개업일을 항상 넣음)와 호환된다.
-- 되돌리기: 개업일이 빈 기업 행이 없을 때만
--   alter table users drop constraint ck_users_business_fields;
--   alter table users add constraint ck_users_business_fields check (user_class <> 'business' or (bus_reg_id is not null
--       and company_type is not null and company_name is not null and company_open_date is not null));
alter table users drop constraint ck_users_business_fields;
alter table users add constraint ck_users_business_fields check (
    user_class <> 'business' or (bus_reg_id is not null and company_type is not null and company_name is not null)
);
