-- 제공가능일(prov_date)·납품희망일(req_deli_date)을 yyyy-MM-dd → yyyyMMdd(숫자만)로 바꾼다 (decisions.md 2026-11-20).
-- 컬럼은 varchar(10) 그대로(8자리가 들어간다). 형식이 정확히 yyyy-MM-dd 인 값만 바꾸므로 이미 8자리거나 빈 값은 그대로이고 다시 돌려도 안전하다.
-- 코드(날짜 입력 정규화 PR)와 같은 배포 단위로 올린다 — 코드는 하이픈 값도 읽지만 검색의 납품일 비교(`prov_date <= yyyyMMdd`)는 숫자만일 때 맞다.
-- 개업일(trd_user_info.company_open_date)은 원래 yyyyMMdd 라 바꾸지 않는다.
-- 되돌리기: 8자리 값을 substr 로 잘라 하이픈을 다시 넣는다 — update trd_prod_reg set prov_date = substr(prov_date,1,4)||'-'||substr(prov_date,5,2)||'-'||substr(prov_date,7,2) where prov_date ~ '^\d{8}$'; (나머지 4개 칸도 같은 식)

update trd_prod_reg  set prov_date     = replace(prov_date, '-', '')     where prov_date     ~ '^\d{4}-\d{2}-\d{2}$';
update trd_trade_info set prov_date    = replace(prov_date, '-', '')     where prov_date     ~ '^\d{4}-\d{2}-\d{2}$';
update trd_trade_info set req_deli_date = replace(req_deli_date, '-', '') where req_deli_date ~ '^\d{4}-\d{2}-\d{2}$';
update trd_cart_info  set prov_date    = replace(prov_date, '-', '')     where prov_date     ~ '^\d{4}-\d{2}-\d{2}$';
update trd_cart_info  set req_deli_date = replace(req_deli_date, '-', '') where req_deli_date ~ '^\d{4}-\d{2}-\d{2}$';
