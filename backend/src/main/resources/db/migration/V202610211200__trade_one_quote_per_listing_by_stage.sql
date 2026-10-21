-- 견적서 한 건을 끝까지 한 행으로 관리한다 (사용자 결정 2026-10-21, 상무 의견): 수락된 견적에서 [구매]하면 같은 행이
-- 견적수락 → 구매요청 → 구매확정으로 이어진다(TYPE 은 견적조정 그대로). 그래서 "구매자·매물당 견적 행 하나" 제약은
-- 견적 단계(견적요청·견적수락·견적거절)의 행에만 건다 — 구매 단계로 넘어간 행이 있어도 그 매물에 새 견적을 보낼 수 있게.
-- 호환: 제약을 푸는 쪽이라 옛 코드와 호환된다.
-- 되돌리기: drop index ux_trd_trade_info_one_quote;
--   create unique index ux_trd_trade_info_one_quote on trd_trade_info (user_id, seller_id, reg_date) where trade_type = '견적조정';
drop index ux_trd_trade_info_one_quote;
create unique index ux_trd_trade_info_one_quote on trd_trade_info (user_id, seller_id, reg_date)
    where trade_type = '견적조정' and trade_stats in ('견적요청', '견적수락', '견적거절');
