-- 견적조정 행은 납품희망일을 받지 않는다 (사용자 결정 2026-10-20, docs/superpowers/specs/2026-10-20-quote-request-design.md).
-- 정의서는 NOT NULL 이지만 견적 요청에는 넣을 값이 없어 null 을 허용한다. 제약을 푸는 것뿐이라 직전 배포 코드(항상 값을 넣음)와 호환된다.
-- 되돌리기: null 행을 지우거나 채운 뒤 alter table trd_trade_info alter column req_deli_date set not null;
alter table trd_trade_info alter column req_deli_date drop not null;
