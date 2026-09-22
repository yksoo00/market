-- 사업자 ↔ 담당자. 1단계는 owner 1명. docs/data-model.md 1절 "organization_members"
-- 되돌리기: drop table organization_members;
create table organization_members (
    id               uuid primary key default gen_random_uuid(),
    organization_id  uuid not null references organizations (id),
    user_id          uuid not null references users (id),
    role             text not null default 'owner' check (role in ('owner', 'member')),
    created_at       timestamptz not null,
    updated_at       timestamptz not null
);

create unique index ux_organization_members_org_user on organization_members (organization_id, user_id);
create unique index ux_organization_members_owner on organization_members (organization_id) where role = 'owner';
-- 한 사람은 한 회사의 담당자만 (decisions.md 2026-09-22). FK 인덱스 겸용
create unique index ux_organization_members_user_id on organization_members (user_id);
