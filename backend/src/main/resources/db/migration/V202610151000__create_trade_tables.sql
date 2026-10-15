-- 거래정보(정의서 TRD_TRADE_INFO)·거래이력(TRD_TRADE_HISTORY). 구매요청 → 구매자 거래완료(구매확정) / 취소 흐름용.
-- 되돌리기: drop table trd_trade_history; drop table trd_trade_info; (이력 먼저, FK 때문)
--
-- 정의서와 다른 점 (사용자 결정, 2026-10-15 — docs/superpowers/specs/2026-10-15-purchase-design.md):
-- 1. 사용자ID·판매자ID·구매자ID 는 varchar(20) 이 아니라 uuid (trd_user_info.uid, trd_prod_reg.user_id 와 같은 값).
-- 2. 거래정보의 판매자ID 물리명이 USER_ID 로 구매자와 겹쳐 seller_id 로 바꿨다. (seller_id, reg_date) 가 매물을 가리킨다.
-- 3. 거래이력의 판매자ID·구매자ID 는 물리명이 논리명과 뒤바뀌어(판매자=BUYER_ID) seller_id·buyer_id 로 바로잡았다.
-- 4. prod_id 는 정의서 50자 대신 trd_prod_master.prod_id 와 같은 20자.
-- 5. 거래정보 prov_date(제공가능일 복사본)는 nullable — 매물 납기일이 선택이라 비어 있을 수 있다.
--    그때는 구매자가 납품희망일(req_deli_date, NOT NULL)을 반드시 넣는다.
-- 6. 거래정보 trade_id 에 unique — PK 는 (user_id, trade_id) 지만 거래이력이 trade_id 하나로 거래를 가리킨다.
-- 7. FK 컬럼 인덱스 (db.md 규칙). 새 빈 테이블이라 CONCURRENTLY 없이 만든다(기존 마이그레이션과 같음).

create table trd_trade_info (
    user_id            uuid         not null,
    trade_id           varchar(20)  not null,
    trade_type         varchar(20)  not null,
    seller_id          uuid,
    reg_date           varchar(14),
    prod_id            varchar(20),
    prod_state         varchar(20),
    sales_unit_price   integer,
    stock_quantity     integer,
    min_order_quantity integer,
    order_unit         integer,
    prov_date          varchar(10),
    order_unit_price   integer      not null,
    order_quantity     integer      not null,
    req_deli_date      varchar(10)  not null,
    remarks            varchar(100),
    trade_stats        varchar(10)  not null,
    spare_col          varchar(100),
    constraint trd_trade_info_pkey primary key (user_id, trade_id),
    constraint ux_trd_trade_info_trade_id unique (trade_id),
    constraint fk_trd_trade_info_buyer foreign key (user_id) references trd_user_info (uid),
    constraint fk_trd_trade_info_listing foreign key (seller_id, reg_date) references trd_prod_reg (user_id, reg_date)
);

create index ix_trd_trade_info_listing on trd_trade_info (seller_id, reg_date);

create table trd_trade_history (
    trade_id           varchar(20)  not null,
    trade_date         varchar(14)  not null,
    prod_id            varchar(20)  not null,
    trade_type         varchar(10)  not null,
    seller_id          uuid         not null,
    buyer_id           uuid         not null,
    trade_unit_price   integer,
    trade_quantity     integer,
    trade_amount       integer,
    spare_col          varchar(100),
    constraint trd_trade_history_pkey primary key (trade_id, trade_date, prod_id),
    constraint fk_trd_trade_history_trade foreign key (trade_id) references trd_trade_info (trade_id),
    constraint fk_trd_trade_history_seller foreign key (seller_id) references trd_user_info (uid),
    constraint fk_trd_trade_history_buyer foreign key (buyer_id) references trd_user_info (uid)
);

create index ix_trd_trade_history_seller on trd_trade_history (seller_id);
create index ix_trd_trade_history_buyer on trd_trade_history (buyer_id);
