-- 개발 계정 스키마를 사용자 제공 단일 사용자 테이블로 교체한다.
-- 되돌리기: 기존 V202609211800~1805 스키마를 새 데이터베이스에 다시 적용한다.
-- 개발 DB 초기화가 승인되어 기존 계정 데이터는 보존하지 않는다.
drop table if exists organization_members;
drop table if exists social_accounts;
drop table if exists identity_verifications;
drop table if exists terms_agreements;
drop table if exists organizations;
drop table if exists users;

create table users (
    id                  uuid primary key default gen_random_uuid(),
    user_id             varchar(20) not null,
    password            varchar(200) not null,
    user_class          varchar(10) not null check (user_class in ('personal', 'business')),
    user_name           varchar(50) not null,
    user_phone          varchar(20),
    user_tel             varchar(20),
    user_email          varchar(100),
    user_address        varchar(200),
    bus_reg_id          varchar(20),
    company_type        varchar(10),
    company_name        varchar(50),
    company_open_date   varchar(10),
    company_tel         varchar(20),
    company_address     varchar(200),
    dt_reg              varchar(14) not null,
    dt_update           varchar(14) not null,
    dt_expire           varchar(14),
    user_nickname       varchar(100),
    nickname_usage      varchar(1) not null default 'N' check (nickname_usage in ('Y', 'N')),
    contact_method      varchar(1) not null default '1' check (contact_method in ('1', '2', '3')),
    spare_col           varchar(40),
    role                varchar(10) not null default 'user' check (role in ('user', 'admin')),
    status              varchar(10) not null default 'active' check (status in ('active', 'suspended', 'withdrawn')),
    must_change_password boolean not null default false,
    deleted_at          timestamptz,
    constraint ck_users_withdrawn_deleted check ((status = 'withdrawn') = (deleted_at is not null)),
    constraint ck_users_business_fields check (
        user_class <> 'business' or (bus_reg_id is not null and company_type is not null
            and company_name is not null and company_open_date is not null)
    )
);

create unique index ux_users_user_id on users (user_id) where deleted_at is null;
create unique index ux_users_bus_reg_id on users (bus_reg_id) where deleted_at is null and user_class = 'business';
create unique index ux_users_email on users (lower(user_email)) where deleted_at is null and user_email is not null;
create unique index ux_users_phone on users (user_phone) where deleted_at is null and user_phone is not null;
create unique index ux_users_nickname on users (user_nickname) where deleted_at is null and user_class = 'personal' and nickname_usage = 'Y';
create index ix_users_class_status on users (user_class, status);
