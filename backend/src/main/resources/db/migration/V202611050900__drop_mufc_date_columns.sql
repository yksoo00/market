-- 제조일 컬럼 삭제 (사용자 결정 2026-11-04, decisions.md "제조일 삭제"). 2단계 — 1단계(PR #129)에서 코드가 두 컬럼을 이미 안 읽고 안 쓴다.
-- 지우는 컬럼:
--   trd_prod_master.prod_mufc_date  정의서 PROD_MASTER 에 없는 컬럼 (재사용 키로 유지하던 것)
--   trd_cart_info.mufc_date         정의서 CART_INFO 에는 있지만 원본(상품 제조일)이 없어졌다
-- 정의서와 달라지는 점: trd_cart_info 에 정의서의 MUFC_DATE 가 없다 (사용자 결정 2026-11-04). 정의서 파일은 사용자 쪽에서 고친다.
-- 되돌리는 방법 (Flyway 무료는 undo 없음): 아래 두 줄로 빈 컬럼만 되살린다. 지워진 값은 복구할 수 없다.
--   alter table trd_prod_master add column prod_mufc_date varchar(14);
--   alter table trd_cart_info add column mufc_date varchar(14);
-- 운영에 먼저 1단계(컬럼을 안 읽는 코드)가 배포된 뒤에만 낸다 — 옛 서버가 도는 동안 컬럼이 사라지면 쿼리가 깨진다.

alter table trd_prod_master drop column prod_mufc_date;
alter table trd_cart_info drop column mufc_date;
