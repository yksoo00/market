-- 거래정보(trd_trade_info)를 정의서에 맞춘다 (2026-10-27). PK (user_id, trade_id) 는 정의서와 같아 그대로.
-- 1. 매물 등록일시 reg_date → 정의서 prod_reg_date, NOT NULL.
-- 2. 정의서 등록일시 reg_date(거래 등록일시)를 새로 둔다. 기존 행은 거래ID 앞 8자리(yyMMddHH)로 채운다 (분·초 00).
-- 3. prod_id 20 → 정의서 50.
-- 4. 제공가능일·납품희망일 NOT NULL (정의서). 비어 있던 행(견적 행 등)은 그 매물의 제공가능일로 채운다.
-- 5. trade_id unique 는 거래이력 외래키 때문에 두었던 것이라 외래키와 함께 없앤다.
-- 6. 구매자·매물당 견적 1행·장바구니 1행 부분 unique 와 목록 인덱스를 매물 세 값(seller_id, prod_reg_date, prod_id)으로.
-- 운영 배포 전이라 이름 변경·NOT NULL 을 배포 1회로 한다 (decisions.md 2026-10-27).
-- 되돌리기: 인덱스를 (user_id, seller_id, reg_date) 로 되돌리고, unique (trade_id) 추가, NOT NULL 해제,
--   reg_date 삭제, prod_reg_date → reg_date, prod_id 를 varchar(20) 으로.

alter table trd_trade_info rename column reg_date to prod_reg_date;
alter table trd_trade_info alter column prod_reg_date set not null;

alter table trd_trade_info add column reg_date varchar(14);
update trd_trade_info set reg_date = '20' || substr(trade_id, 1, 8) || '0000';

alter table trd_trade_info alter column prod_id type varchar(50);

update trd_trade_info t
   set prov_date = l.prov_date
  from trd_prod_reg l
 where t.prov_date is null and l.user_id = t.seller_id and l.reg_date = t.prod_reg_date;
alter table trd_trade_info alter column prov_date set not null;

update trd_trade_info set req_deli_date = prov_date where req_deli_date is null;
alter table trd_trade_info alter column req_deli_date set not null;

alter table trd_trade_info drop constraint ux_trd_trade_info_trade_id;

drop index ux_trd_trade_info_one_quote;
create unique index ux_trd_trade_info_one_quote on trd_trade_info (user_id, seller_id, prod_reg_date, prod_id)
    where trade_type = '견적조정' and trade_stats in ('견적요청', '견적수락', '견적거절');

drop index ux_trd_trade_info_one_cart;
create unique index ux_trd_trade_info_one_cart on trd_trade_info (user_id, seller_id, prod_reg_date, prod_id)
    where trade_type = '구매검토' and trade_stats = '장바구니';

drop index ix_trd_trade_info_listing;
create index ix_trd_trade_info_listing on trd_trade_info (seller_id, prod_reg_date, prod_id);
