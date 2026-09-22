-- 소셜 로그인 연결 (카카오·네이버·구글). 계정당 하나. docs/data-model.md 1절 "social_accounts"
-- 되돌리기: drop table social_accounts;
create table social_accounts (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references users (id),
    provider          text not null check (provider in ('kakao', 'naver', 'google')),
    provider_user_id  text not null,                              -- 제공자의 회원 고유번호
    provider_email    text,                                       -- PII, 암호화. users.email 과 별도 (대조용)
    connected_at      timestamptz not null,
    created_at        timestamptz not null,
    updated_at        timestamptz not null
);

create unique index ux_social_accounts_provider_user on social_accounts (provider, provider_user_id);
-- 한 계정에 소셜 연결은 하나만 (decisions.md 2026-09-22). FK 인덱스 겸용
create unique index ux_social_accounts_user_id on social_accounts (user_id);
