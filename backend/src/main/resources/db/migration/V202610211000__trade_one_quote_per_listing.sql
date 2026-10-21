-- 같은 구매자는 같은 매물에 견적(견적조정) 행을 하나만 가진다 (사용자 결정 2026-10-21). 재요청은 그 행을 덮어쓴다.
-- 이미 둘 이상이면 가장 최근(trade_id 가 큰) 행만 남긴다. 견적 행은 거래이력이 가리키지 않아 지워도 FK 에 걸리지 않는다.
-- 호환: 견적 코드(feat/quote-request)와 같은 배포로만 나간다 (V202610201010 과 같음).
-- 되돌리기: drop index ux_trd_trade_info_one_quote;
delete from trd_trade_info t
 where t.trade_type = '견적조정'
   and exists (select 1 from trd_trade_info n
                where n.trade_type = '견적조정' and n.user_id = t.user_id
                  and n.seller_id = t.seller_id and n.reg_date = t.reg_date and n.trade_id > t.trade_id);

create unique index ux_trd_trade_info_one_quote on trd_trade_info (user_id, seller_id, reg_date) where trade_type = '견적조정';
