-- 모든 외래키를 없앤다. 정의서의 FOREIGN KEY 표는 의미상 관계이고 DB 제약이 아니다 (사용자 결정 2026-10-27).
-- 매물·거래·사용자 사이의 정합은 서버 코드가 지킨다 (거래 → 매물은 판매자ID·매물 등록일시·상품ID 세 값으로 찾는다).
-- 되돌리기: V202609291000·V202610131520·V202610151000 의 외래키 정의를 다시 추가한다.

alter table trd_prod_master drop constraint fk_trd_prod_master_category;
alter table trd_prod_reg drop constraint trd_prod_reg_user_id_fkey;
alter table trd_prod_reg drop constraint trd_prod_reg_prod_id_fkey;
alter table trd_trade_info drop constraint fk_trd_trade_info_buyer;
alter table trd_trade_info drop constraint fk_trd_trade_info_listing;
alter table trd_trade_history drop constraint fk_trd_trade_history_trade;
alter table trd_trade_history drop constraint fk_trd_trade_history_seller;
alter table trd_trade_history drop constraint fk_trd_trade_history_buyer;
