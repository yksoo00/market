-- 카테고리 마스터(정의서 TRD_CTGR_MASTER). 코드는 경로(P01-Q01-R001)가 아니라 조각(R001) 하나, 부모는 부모 조각.
-- 상품마스터가 대·중·소 조각을 따로 갖고(V202610281010), 이 테이블로 조각의 이름과 부모 관계를 찾는다.
-- trd_ctgr_code(경로 코드)는 그대로 둔다 — 카테고리 패널(GET /categories)이 읽는다.
--
-- 정의서와 다른 점 (사용자 결정 2026-10-27):
-- 1. category_code varchar(12) — 정의서 4. 나중에 코드 체계가 바뀔 수 있어 trd_ctgr_code 와 같은 길이로 둔다.
-- 2. parent_code nullable — 정의서 NOT NULL. 대분류는 부모가 없다.
--
-- 채우기: trd_ctgr_code 239행. 코드 = 경로의 마지막 조각, 분류레벨 = category_class(대/중/소).
-- 조각 코드 239개는 서로 겹치지 않는다(2026-10-27 확인) — 겹치면 PK 충돌로 이 마이그레이션이 멈춘다.
-- 되돌리기: drop table trd_ctgr_master;

create table trd_ctgr_master (
    category_code  varchar(12) not null,
    category_name  varchar(50) not null,
    category_depth varchar(2)  not null,
    parent_code    varchar(20),
    is_display     char(1)     not null default 'Y',
    sort_order     integer,
    reg_date       varchar(14) not null,
    spare_col      varchar(10),
    constraint trd_ctgr_master_pkey primary key (category_code)
);

insert into trd_ctgr_master (category_code, category_name, category_depth, parent_code, is_display, sort_order, reg_date, spare_col)
select substring(category_code from '[^-]+$'), category_name, category_class, parent_code, is_display, sort_order, reg_date, spare_col
  from trd_ctgr_code;
