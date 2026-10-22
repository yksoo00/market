-- 장바구니(구매검토/장바구니)는 구매자·매물당 한 행 (스펙 2026-10-21-cart-design.md). 이미 담긴 매물을 다시 담으면
-- 건너뛰고, 두 칸에서 동시에 담아도 행이 둘 생기지 않게 DB 가 막는다(담기는 이 인덱스로 on conflict do nothing —
-- 그쪽 where 절이 이 조건과 글자까지 같아야 인덱스를 찾는다). 견적 인덱스(V202610211200)처럼 종류·상태를 같이 본다.
-- 정의서 밖 인덱스 (사용자 승인 2026-10-21). 같은 매물의 견적·거래 행과는 상관없다.
-- concurrently 를 안 쓰는 이유 (db.md 예외): Flyway 가 잠금용 연결을 트랜잭션에 열어 둔 채라 concurrently 가 그 연결을
-- 기다리며 멈춘다(테스트에서 확인). 운영 데이터가 아직 없고 거래 행이 적어 잠금은 짧다. 운영 뒤엔
-- spring.flyway.postgresql.transactional-lock=false 를 켜고 concurrently 로 만든다.
-- 호환: 인덱스만 추가하고 장바구니 행은 아직 없어 옛 코드와 호환된다.
-- 되돌리기: drop index ux_trd_trade_info_one_cart;
create unique index ux_trd_trade_info_one_cart on trd_trade_info (user_id, seller_id, reg_date)
    where trade_type = '구매검토' and trade_stats = '장바구니';
