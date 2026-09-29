-- 상품마스터(TRD_PROD_MASTER), 상품등록정보(TRD_REG_INFO) 스펙을 옮긴다.
-- 되돌리기: 두 테이블 drop (listings 먼저, FK 때문).
--
-- 원본 스펙 대비 조정한 것 (사용자 지시, 2026-09-29):
-- 1. uuid 서로게이트 PK 없음(일단). 스펙의 비즈니스 키를 그대로 PK로 쓴다.
--    products는 prod_id, listings는 (user_id, reg_date) 복합키(원본에 둘 다 기본키로 표시됨).
--    같은 사용자가 같은 초에 두 번 등록하면 충돌 — 원본 설계 그대로라 일단 감수, 추후 재검토.
-- 2. TRD_REG_INFO의 "사용자ID"는 로그인 아이디 문자열이 아니라 users.id(uuid)를 그대로 담는다.
--    조직(seller_org_id) 개념은 일단 넣지 않는다 — decisions.md 미정 항목 중 이 부분을 이 커밋에서 확정.
-- 3. TRD_REG_INFO 원본에 물리명 REG_DATE가 "등록일시"와 "납기일" 두 논리 컬럼에
--    중복 기재되어 있다 (한 테이블에 동일 컬럼명 불가). 납기일은 delivery_date로 분리했다.
-- 4. products(prod_name, prod_brand)에 유니크 인덱스 추가 — 동시에 같은 상품을 처음 등록하면
--    이름+제조사가 같은 행이 두 개 생길 수 있어서(코드리뷰 지적). ProductService가 이 제약 위반을
--    "이미 만들어졌다"는 신호로 잡아 재조회한다. listings.reg_date에도 목록 조회용 인덱스 추가.

create table products (
    prod_id             varchar(20) primary key,
    category_code       varchar(10) not null,
    prod_name           varchar(50) not null,
    prod_no             varchar(20),
    prod_brand          varchar(50) not null,
    prod_mufc_date      varchar(14),
    prod_spec_info      varchar(100),
    prod_data_sheet     varchar(100),
    prod_photo_1        varchar(100),
    reg_date            varchar(14) not null,
    spare_col           varchar(100)
);

create unique index ux_products_name_brand on products (prod_name, prod_brand);

create table listings (
    user_id                 uuid not null references users (id),
    reg_date                varchar(14) not null,
    prod_id                 varchar(20) not null references products (prod_id),
    trade_type              varchar(20) not null,
    prod_state               varchar(20) not null,
    sales_unit_price        integer not null,
    sales_quantity          integer not null,
    min_order_quantity      integer not null default 1,
    order_unit              integer not null default 1,
    delivery_date           varchar(10),
    stock_quantity          integer,
    prod_description        varchar(200),
    prod_data_sheet         varchar(100),
    prod_photo_1            varchar(100),
    prod_photo_2            varchar(100),
    prod_photo_3            varchar(100),
    prod_image_4            varchar(100),
    warranty_period         integer,
    warranty_coverage       varchar(10),
    replace_prod            varchar(100),
    test_report             varchar(100),
    certificate_of_authen   varchar(100),
    dt_update                varchar(14),
    dt_expire                varchar(14),
    spare_col                varchar(100),
    primary key (user_id, reg_date)
);

create index ix_listings_prod_id on listings (prod_id);
create index ix_listings_reg_date on listings (reg_date);
