-- 상품마스터(TRD_PROD_MASTER)를 정의서(2026-10-27 판)에 맞춘다. 설계: docs/superpowers/specs/2026-10-27-definition-realign-design.md "PR 2".
-- 운영 배포 전이라 컬럼 이름 변경·삭제를 배포 1회로 한다 (decisions.md 2026-10-27).
--
-- 정의서와 다른 점 (사용자 결정):
-- 1. prod_image varchar(100) — 정의서 40. 저장 파일 키가 80자까지 된다.
-- 2. prod_data_sheet varchar(100) — 정의서 40. 같은 이유.
-- 3. prod_mufc_date 유지 — 정의서에 없음. 직접 입력 재사용 키(이름·제조사·분류번호·제조일)에 쓴다.
--
-- 카테고리: 경로 코드(category_code 'P01-Q01-R001') 하나 대신 대·중·소 조각 세 칸. 조각의 이름·부모는 trd_ctgr_master.
-- unique (prod_name, prod_brand) 는 없앤다 — 같은 이름·제조사라도 분류번호·제조일이 다르면 다른 상품.
--   같은 네 값 중복 생성은 서버가 advisory lock 으로 줄 세워 막는다 (ProductRepository.lockCreation).
-- 되돌리기: 새 칸 drop, category_code 를 조각 셋을 '-' 로 이어 다시 채운 뒤 not null·unique 복구, 이름 변경 반대로.

alter table trd_prod_master rename column prod_mpn to prod_part_no;
alter table trd_prod_master rename column prod_photo_1 to prod_image;

alter table trd_prod_master
    add column major_category   varchar(40),
    add column middle_category  varchar(40),
    add column minor_category   varchar(40),
    add column prod_class_no    varchar(20),
    add column prod_useful_life integer,
    add column warranty_method  varchar(20),
    add column alter_prod_name  varchar(40);

update trd_prod_master
   set major_category  = nullif(split_part(category_code, '-', 1), ''),
       middle_category = nullif(split_part(category_code, '-', 2), ''),
       minor_category  = nullif(split_part(category_code, '-', 3), '');

drop index ux_trd_prod_master_name_brand;
alter table trd_prod_master drop column category_code;
alter table trd_prod_master drop column prod_scan_code;

-- 41자 이상 제조사가 있으면 여기서 멈춘다 (2026-10-28 로컬 개발 DB 0건 확인)
alter table trd_prod_master alter column prod_brand type varchar(40);
alter table trd_prod_master alter column prod_brand drop not null;
alter table trd_prod_master alter column prod_name drop not null;
alter table trd_prod_master alter column reg_date drop not null;
