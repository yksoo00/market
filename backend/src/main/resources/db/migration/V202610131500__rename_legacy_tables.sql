-- 상품마스터·판매물품·유저 테이블을 사용자 정의서 물리명(TRD_PROD_MASTER·TRD_PROD_REG·TRD_USER_INFO)으로 바꾼다.
-- 9/29 결정(products·listings·users 이름 사용)을 뒤집는다. 개발 볼륨을 초기화하는 전제라 배포 1회로 처리한다.
-- 되돌리기: 아래 rename 을 반대로 적용하고 prod_scan_code 를 drop 한다.

alter table products rename to trd_prod_master;
alter table listings rename to trd_prod_reg;
alter table users rename to trd_user_info;

alter table trd_prod_master rename column prod_no to prod_mpn;
alter table trd_prod_reg rename column delivery_date to prov_date;
alter table trd_prod_reg rename column certificate_of_authen to prod_coa;
alter table trd_user_info rename column id to uid;

-- 정의서의 상품 스캔 코드. 아직 채우는 곳이 없어 nullable.
alter table trd_prod_master add column prod_scan_code varchar(20);

-- 제약·인덱스 이름도 새 테이블명 접두로 맞춘다 (이후 마이그레이션이 trd_* 이름으로 참조).
alter table trd_prod_master rename constraint products_pkey to trd_prod_master_pkey;
alter index ux_products_name_brand rename to ux_trd_prod_master_name_brand;

alter table trd_prod_reg rename constraint listings_pkey to trd_prod_reg_pkey;
alter table trd_prod_reg rename constraint listings_user_id_fkey to trd_prod_reg_user_id_fkey;
alter table trd_prod_reg rename constraint listings_prod_id_fkey to trd_prod_reg_prod_id_fkey;
alter index ix_listings_prod_id rename to ix_trd_prod_reg_prod_id;
alter index ix_listings_reg_date rename to ix_trd_prod_reg_reg_date;

alter table trd_user_info rename constraint users_pkey to trd_user_info_pkey;
alter table trd_user_info rename constraint users_user_class_check to trd_user_info_user_class_check;
alter table trd_user_info rename constraint users_nickname_usage_check to trd_user_info_nickname_usage_check;
alter table trd_user_info rename constraint users_contact_method_check to trd_user_info_contact_method_check;
alter table trd_user_info rename constraint users_role_check to trd_user_info_role_check;
alter table trd_user_info rename constraint users_status_check to trd_user_info_status_check;
alter table trd_user_info rename constraint ck_users_withdrawn_deleted to ck_trd_user_info_withdrawn_deleted;
alter table trd_user_info rename constraint ck_users_business_fields to ck_trd_user_info_business_fields;
alter index ux_users_user_id rename to ux_trd_user_info_user_id;
alter index ux_users_bus_reg_id rename to ux_trd_user_info_bus_reg_id;
alter index ux_users_email rename to ux_trd_user_info_email;
alter index ux_users_phone rename to ux_trd_user_info_phone;
alter index ux_users_nickname rename to ux_trd_user_info_nickname;
alter index ix_users_class_status rename to ix_trd_user_info_class_status;
