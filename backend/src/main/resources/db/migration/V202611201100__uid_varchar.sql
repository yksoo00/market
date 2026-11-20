-- 사용자 식별자 uid 를 uuid → varchar(11) 로 바꾸고 기존 사용자에게 새 uid(UP + yyMMdd + 일련번호 3자리)를 준다 (decisions.md 2026-11-20, 계획 2026-11-20-uid-and-date-format.md PR 2·3).
-- 새 uid = 가입일(dt_reg 를 UTC 로 보고 한국 날짜로 바꾼 yyMMdd) 기준 날짜별 001~. 같은 날 가입자는 dt_reg, uid 순.
-- uid 를 담는 컬럼 전부(2026-11-20 information_schema 조사): trd_user_info.uid, trd_prod_reg.user_id, trd_trade_info.user_id·seller_id,
--   trd_cart_info.user_id·seller_id, trd_trade_history.user_id·seller_id, trd_inquiry.author_uid, trd_inquiry_reply.author_uid.
--   외래키는 없다(2026-10-27 방침) — 값 변환 UPDATE 가 아니라 타입 변경 USING 으로 같이 바꾼다.
-- 사용자 행이 없는 옛 uuid(고아 값)는 하이픈을 뺀 앞 11자리로 둔다 — 마이그레이션이 멈추지 않게. 운영 전에는 없다.
-- 이 마이그레이션 뒤에는 리프레시 세션(Redis)·JWT 의 옛 uuid 가 무효라 모두 다시 로그인해야 한다.
-- 되돌리기: 옛 uuid 를 보관하지 않으므로 값은 복구할 수 없다. 타입만 되돌리려면 새 uuid 를 다시 만들어 매핑하는 별도 작업이 필요하다.
-- 코드(String uid, UidGenerator)와 같은 배포 단위로 올린다 — 스키마와 엔티티 타입이 맞아야 기동된다.

create temporary table uid_map on commit drop as
with seoul as (
    -- dt_reg 는 UTC 로 저장돼 있다 — 새 가입자의 uid(UidGenerator)가 한국 날짜라서 같은 기준(한국 날짜)으로 맞춘다
    select uid, dt_reg,
           case when dt_reg ~ '^[0-9]{14}$'
                then to_char((make_timestamp(substr(dt_reg, 1, 4)::int, substr(dt_reg, 5, 2)::int, substr(dt_reg, 7, 2)::int,
                                             substr(dt_reg, 9, 2)::int, substr(dt_reg, 11, 2)::int, substr(dt_reg, 13, 2)::int)
                              at time zone 'UTC') at time zone 'Asia/Seoul', 'YYMMDD')
                else to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') end as day
      from trd_user_info
)
select uid as old_uid,
       'UP' || day || lpad(row_number() over (partition by day order by dt_reg, uid)::text, 3, '0') as new_uid
  from seoul;

do $$
begin
    if exists (select 1 from uid_map where length(new_uid) > 11) then
        raise exception '같은 날 가입자가 999명을 넘어 uid 3자리를 넘는다 (uid_map)';
    end if;
end
$$;

create or replace function pg_temp.uid_new(u uuid) returns varchar language sql stable as $$
    select coalesce((select new_uid from uid_map where old_uid = u), left(replace(u::text, '-', ''), 11))
$$;

alter table trd_user_info alter column uid drop default;
alter table trd_user_info alter column uid type varchar(11) using pg_temp.uid_new(uid);
alter table trd_prod_reg alter column user_id type varchar(11) using pg_temp.uid_new(user_id);
alter table trd_trade_info alter column user_id type varchar(11) using pg_temp.uid_new(user_id);
alter table trd_trade_info alter column seller_id type varchar(11) using pg_temp.uid_new(seller_id);
alter table trd_cart_info alter column user_id type varchar(11) using pg_temp.uid_new(user_id);
alter table trd_cart_info alter column seller_id type varchar(11) using pg_temp.uid_new(seller_id);
alter table trd_trade_history alter column user_id type varchar(11) using pg_temp.uid_new(user_id);
alter table trd_trade_history alter column seller_id type varchar(11) using pg_temp.uid_new(seller_id);
alter table trd_inquiry alter column author_uid type varchar(11) using pg_temp.uid_new(author_uid);
alter table trd_inquiry_reply alter column author_uid type varchar(11) using pg_temp.uid_new(author_uid);

drop function pg_temp.uid_new(uuid);
