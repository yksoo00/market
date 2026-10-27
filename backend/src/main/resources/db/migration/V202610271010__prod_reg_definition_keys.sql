-- 상품등록정보(trd_prod_reg)를 정의서에 맞춘다 (2026-10-27).
-- 1. PK (user_id, reg_date) → 정의서 (user_id, reg_date, prod_id). 같은 사용자 같은 초 등록은 서버가 잠금으로 409.
-- 2. 제공가능일(prov_date) NOT NULL (정의서). 비어 있던 행은 등록일(reg_date 앞 8자리)로 채운다.
-- 3. 정품인증서 prod_coa → 정의서 물리명 CERTIFICATE OF AUTHENTICITY 를 밑줄로.
-- 4. 최소주문량·주문단위는 정의서에서 NOT NULL 이 아니다 (기본값 1 은 유지).
-- 운영 배포 전이라 이름 변경·NOT NULL 을 배포 1회로 한다 (decisions.md 2026-10-27).
-- 되돌리기: 아래를 역순으로 (PK 를 (user_id, reg_date) 로, 이름을 prod_coa 로, NOT NULL 을 반대로).

update trd_prod_reg
   set prov_date = to_char(to_date(substr(reg_date, 1, 8), 'YYYYMMDD'), 'YYYY-MM-DD')
 where prov_date is null;
alter table trd_prod_reg alter column prov_date set not null;

alter table trd_prod_reg drop constraint trd_prod_reg_pkey;
alter table trd_prod_reg add constraint trd_prod_reg_pkey primary key (user_id, reg_date, prod_id);

alter table trd_prod_reg rename column prod_coa to certificate_of_authenticity;

alter table trd_prod_reg alter column min_order_quantity drop not null;
alter table trd_prod_reg alter column order_unit drop not null;
