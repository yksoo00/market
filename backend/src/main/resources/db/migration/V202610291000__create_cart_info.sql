-- 장바구니 정보(정의서 TRD_CART_INFO). 장바구니·비교 한 건 = trd_trade_info 1행(구매검토, 거래상태 장바구니|비교용) + 이 테이블 1행(같은 거래ID).
-- 설계: docs/superpowers/specs/2026-10-27-definition-realign-design.md "PR 3". 외래키는 없다(2026-10-27).
--
-- 정의서와 다른 점:
-- 1. user_id·seller_id uuid — 정의서 varchar(20). trd_user_info.uid 와 같은 값 (사용자 결정 2026-10-27).
-- 2. 물리명 REG_DATE 가 셋(상품등록일시·제공가능일·등록일시)이라 prod_date·prov_date·reg_date 로 나눴다 (사용자 결정).
-- 3. cart_type 값은 '장바구니' / '비교용' — 정의서 설명의 "방바구니/비교용바구니"는 오타.
-- 4. ux_trd_trade_info_one_cart 를 거래상태까지 포함해 다시 만든다 — 한 매물이 장바구니와 비교에 각각 1줄 (새 인덱스가 아니라 기존 인덱스 변경).
--
-- 채우기: 기존 장바구니 거래 행(구매검토/장바구니)마다 1행. 상품 값은 상품마스터, 빈 사양은 ''.
-- 되돌리기: drop table trd_cart_info; drop index ux_trd_trade_info_one_cart; 그리고 V202610271020 의 정의로 다시 만든다.

create table trd_cart_info (
    user_id          uuid         not null,
    trade_id         varchar(20)  not null,
    ser_no           integer      not null,
    cart_type        varchar(10),
    seller_id        uuid,
    prod_date        varchar(14)  not null,
    prod_name        varchar(50)  not null,
    prod_no          varchar(20)  not null,
    manufacturer     varchar(50),
    mufc_date        varchar(14),
    prod_spec_info   varchar(100) not null,
    prod_state       varchar(20)  not null,
    prov_date        varchar(10)  not null,
    order_unit_price integer      not null,
    order_quantity   integer      not null,
    req_deli_date    varchar(10)  not null,
    remarks          varchar(100),
    reg_date         varchar(14)  not null,
    constraint trd_cart_info_pkey primary key (user_id, trade_id, ser_no)
);

insert into trd_cart_info (user_id, trade_id, ser_no, cart_type, seller_id, prod_date, prod_name, prod_no, manufacturer,
        mufc_date, prod_spec_info, prod_state, prov_date, order_unit_price, order_quantity, req_deli_date, remarks, reg_date)
select t.user_id, t.trade_id,
       row_number() over (partition by t.user_id order by t.trade_id),
       '장바구니', t.seller_id, t.prod_reg_date, coalesce(p.prod_name, ''), t.prod_id, p.prod_brand,
       p.prod_mufc_date, coalesce(p.prod_spec_info, ''), coalesce(t.prod_state, ''), t.prov_date,
       t.order_unit_price, t.order_quantity, t.req_deli_date, t.remarks, coalesce(t.reg_date, '')
  from trd_trade_info t
  left join trd_prod_master p on p.prod_id = t.prod_id
 where t.trade_type = '구매검토' and t.trade_stats = '장바구니';

drop index ux_trd_trade_info_one_cart;
create unique index ux_trd_trade_info_one_cart on trd_trade_info (user_id, seller_id, prod_reg_date, prod_id, trade_stats)
    where trade_type = '구매검토';
