-- 거래정보 거래ID 찾기용 일반 인덱스 (정의서 밖, 사용자 승인 2026-10-27).
-- unique(trade_id) 를 외래키와 함께 지우면서(V202610271020) trade_id 로 시작하는 인덱스가 없어졌다. PK (user_id, trade_id) 는
-- 구매자가 앞자리라 거래ID 만으로 찾는 조회(확정·취소·수락·거절, 거래ID 순번 조회)가 전체 훑기가 된다. 중복 금지는 다시 걸지 않는다.
-- 운영 데이터 전이라 concurrently 없이 만든다 (concurrently 는 Flyway 잠금에 멈춤).
-- 되돌리기: drop index ix_trd_trade_info_trade_id;

create index ix_trd_trade_info_trade_id on trd_trade_info (trade_id);
