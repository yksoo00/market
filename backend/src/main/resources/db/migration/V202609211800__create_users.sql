-- 계정 주체 (일반·소셜·기업 담당자 공통). docs/data-model.md 1절 "users"
-- 되돌리기: drop table users;
create table users (
    id                   uuid primary key default gen_random_uuid(),
    kind                 text not null check (kind in ('personal', 'business')),
    role                 text not null default 'user' check (role in ('user', 'admin')),
    status               text not null default 'active' check (status in ('active', 'suspended', 'withdrawn')),
    login_id             text,                                   -- personal 아이디 로그인만. 소셜·기업은 null
    password_hash        text,                                   -- bcrypt. 소셜만 null (앱에서 검사)
    nickname             text not null,                          -- personal 표시명 / business 는 기업명
    email                text,                                   -- PII
    email_verified_at    timestamptz,
    name                 text,                                   -- PII, 암호화 (PiiConverter)
    phone                text,                                   -- PII, 암호화 (PiiConverter)
    phone_hash           text,                                   -- HMAC-SHA256(phone) (PiiHasher). 암호화 컬럼은 검색 불가라 중복 검사용
    marketing_opt_in_at  timestamptz,
    last_login_at        timestamptz,
    must_change_password boolean not null default false,
    created_at           timestamptz not null,
    updated_at           timestamptz not null,
    deleted_at           timestamptz,                            -- 탈퇴 (soft delete)
    -- 탈퇴 상태와 deleted_at 이 따로 놀 수 없게
    constraint ck_users_withdrawn_deleted check ((status = 'withdrawn') = (deleted_at is not null))
);

-- 유일 제약은 삭제 안 된 행만: 탈퇴 후 같은 아이디·이메일로 재가입 가능
create unique index ux_users_login_id on users (login_id) where deleted_at is null;
create unique index ux_users_nickname_personal on users (nickname) where deleted_at is null and kind = 'personal';
create unique index ux_users_email on users (lower(email)) where deleted_at is null;  -- 대소문자만 다른 이메일은 같은 계정
create unique index ux_users_phone_hash on users (phone_hash) where deleted_at is null;
create index ix_users_kind_status on users (kind, status);
