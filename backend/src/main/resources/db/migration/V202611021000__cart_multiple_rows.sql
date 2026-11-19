-- 같은 매물을 장바구니에 여러 줄 담을 수 있게 한다 (사용자 지시 2026-11-02: 담을 때마다 새 거래, 계획
-- docs/superpowers/plans/2026-11-02-stock-hold.md PR 0). 우리가 만든 인덱스(정의서 밖)의 조건을 좁히는 변경이다.
--
-- ux_trd_trade_info_one_cart (user_id, seller_id, prod_reg_date, prod_id, trade_stats, 구매검토 한정)는 장바구니('장바구니')와
-- 비교용('비교용') 행 둘 다에 "구매자·매물당 1행"을 걸고 있었다. 장바구니는 같은 매물도 줄마다 따로 거래이므로 장바구니 행을 뺀다.
-- 비교용은 그대로 매물당 1행.
--
-- 배포 순서: 이 마이그레이션보다 먼저 insertReviewIfAbsent 의 on conflict 대상 지정을 뺀 코드(#114)가 배포돼 있어야 한다
-- (대상 지정은 인덱스 조건과 글자까지 같아야 해서, 옛 코드는 좁혀진 인덱스를 못 찾고 실패한다). 제약을 푸는 방향이라 데이터는 안 바뀐다.
-- 운영 데이터 전이라 concurrently 없이 만든다 (concurrently 는 Flyway 잠금에 멈춤).
--
-- 되돌리기(장바구니에 같은 매물이 두 줄 이상 생기기 전에만):
--   drop index ux_trd_trade_info_one_compare;
--   create unique index ux_trd_trade_info_one_cart on trd_trade_info (user_id, seller_id, prod_reg_date, prod_id, trade_stats)
--       where trade_type = '구매검토';

drop index ux_trd_trade_info_one_cart;
create unique index ux_trd_trade_info_one_compare on trd_trade_info (user_id, seller_id, prod_reg_date, prod_id)
    where trade_type = '구매검토' and trade_stats = '비교용';
