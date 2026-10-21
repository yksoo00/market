-- 거래 코드 값을 정의서 체계로 맞춘다 (사용자 결정 2026-10-20): TRADE_TYPE = 기록 종류(구매검토·견적조정·거래),
-- TRADE_STATS = 진행(장바구니·비교용·견적요청·견적회신·구매요청·구매확정). 취소는 값 없이 행을 지운다.
-- 직접 구매 행: TYPE 구매요청·구매확정·구매취소 → 거래. 취소 행은 지운다(재고는 취소할 때 이미 되돌렸다).
-- 이력의 TYPE 구매확정 → 거래.
-- 호환: 옛 코드는 옛 값을 쓰므로 이 파일은 새 코드(feat/quote-request)와 같은 배포로 나간다. 운영 데이터가 없어 2회 배포로 나누지 않는다.
-- 되돌리기: 지운 취소 행은 되살릴 수 없다. 값은
--   update trd_trade_info set trade_type = case trade_stats when '구매확정' then '구매확정' else '구매요청' end where trade_type = '거래';
--   update trd_trade_history set trade_type = '구매확정' where trade_type = '거래';
delete from trd_trade_info where trade_stats = '취소';
update trd_trade_info set trade_type = '거래' where trade_type in ('구매요청', '구매확정', '구매취소');
update trd_trade_history set trade_type = '거래' where trade_type = '구매확정';
