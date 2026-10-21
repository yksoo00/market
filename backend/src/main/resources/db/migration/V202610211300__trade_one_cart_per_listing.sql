-- 장바구니(구매검토/장바구니)는 구매자·매물당 한 행 (스펙 2026-10-21-cart-design.md). 이미 담긴 매물을 다시 담으면
-- 건너뛰고, 두 칸에서 동시에 담아도 행이 둘 생기지 않게 DB 가 막는다(담기는 이 인덱스로 on conflict do nothing).
-- 정의서 밖 인덱스 (사용자 승인 2026-10-21). 같은 매물의 견적·거래 행과는 상관없다.
-- 호환: 인덱스만 추가하고 장바구니 행은 아직 없어 옛 코드와 호환된다.
-- 되돌리기: drop index ux_trd_trade_info_one_cart;
create unique index ux_trd_trade_info_one_cart on trd_trade_info (user_id, seller_id, reg_date)
    where trade_stats = '장바구니';
