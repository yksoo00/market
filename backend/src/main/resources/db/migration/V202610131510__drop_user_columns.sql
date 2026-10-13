-- 사용자 정의서에 없는 컬럼을 삭제한다 (docs/decisions.md 2026-10-13: 유저는 정의서 컬럼만).
-- 역할·상태·탈퇴·비밀번호 강제 변경·가입 전화(user_tel) 기능을 같이 없앤다.
-- 개발 DB 초기화가 승인되어 있고 운영 데이터가 없어 한 번에 삭제한다 (코드와 같은 배포).
-- 되돌리기: 컬럼을 다시 추가하는 새 마이그레이션을 만든다 (삭제된 값은 복구되지 않음).
alter table trd_user_info drop constraint ck_trd_user_info_withdrawn_deleted;

-- 부분 유니크 인덱스가 deleted_at 을 참조하므로 컬럼 삭제 전에 먼저 지우고, 조건 없이 다시 만든다.
drop index ux_trd_user_info_user_id;
drop index ux_trd_user_info_bus_reg_id;
drop index ux_trd_user_info_email;
drop index ux_trd_user_info_phone;
drop index ux_trd_user_info_nickname;
drop index ix_trd_user_info_class_status;

alter table trd_user_info
    drop column user_tel,
    drop column role,
    drop column status,
    drop column must_change_password,
    drop column deleted_at;

create unique index ux_trd_user_info_user_id on trd_user_info (user_id);
create unique index ux_trd_user_info_bus_reg_id on trd_user_info (bus_reg_id) where user_class = 'business';
create unique index ux_trd_user_info_email on trd_user_info (lower(user_email)) where user_email is not null;
create unique index ux_trd_user_info_phone on trd_user_info (user_phone) where user_phone is not null;
create unique index ux_trd_user_info_nickname on trd_user_info (user_nickname) where user_class = 'personal' and nickname_usage = 'Y';
create index ix_trd_user_info_class on trd_user_info (user_class);
