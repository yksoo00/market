-- 거래이력(trd_trade_history)을 정의서에 맞춘다 (2026-10-27).
-- 1. 구매자 buyer_id → 정의서 user_id. 판매자는 seller_id 그대로 (정의서 물리명이 BUYER_ID 로 뒤바뀐 것을 바로잡은 이름).
-- 2. PK (trade_id, trade_date, prod_id) → 정의서 (user_id, trade_id, trade_date).
-- 3. prod_id 20 → 정의서 50.
-- 4. 구매자 인덱스는 PK 앞자리와 겹쳐 없앤다.
-- 되돌리기: 인덱스 ix_trd_trade_history_buyer 다시, PK 를 (trade_id, trade_date, prod_id) 로, user_id → buyer_id,
--   prod_id 를 varchar(20) 으로.

alter table trd_trade_history rename column buyer_id to user_id;

alter table trd_trade_history drop constraint trd_trade_history_pkey;
alter table trd_trade_history add constraint trd_trade_history_pkey primary key (user_id, trade_id, trade_date);

alter table trd_trade_history alter column prod_id type varchar(50);

drop index ix_trd_trade_history_buyer;
