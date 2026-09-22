-- 사업자. 가입 직후 pending, 관리자 심사 후 approved. docs/data-model.md 1절 "organizations"
-- 되돌리기: drop table organizations;
create table organizations (
    id                uuid primary key default gen_random_uuid(),
    biz_no            text not null,                             -- 사업자등록번호 숫자 10자리
    name              text not null,                             -- 상호
    owner_name        text not null,                             -- 대표자 (국세청 진위확인 입력값)
    start_date        date not null,                             -- 개업년월일
    biz_type          text not null check (biz_type in ('corporation', 'individual')),
    address           text not null,
    license_file_key  text,                                      -- MinIO 키. URL 저장 금지
    nts_verified_at   timestamptz,                               -- 국세청 진위확인 통과 시각. stub 은 null
    review_status     text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
    reviewed_at       timestamptz,
    reviewed_by       uuid references users (id),
    reject_reason     text,
    created_at        timestamptz not null,
    updated_at        timestamptz not null,
    deleted_at        timestamptz,
    -- 심사 결과 없이 approved/rejected 가 될 수 없게
    constraint ck_organizations_reviewed check (review_status = 'pending' or reviewed_at is not null),
    constraint ck_organizations_reject_reason check (review_status <> 'rejected' or reject_reason is not null)
);

-- 사업자번호당 계정 1개 (decisions.md 2026-09-21)
create unique index ux_organizations_biz_no on organizations (biz_no) where deleted_at is null;
create index ix_organizations_review_status on organizations (review_status);
create index ix_organizations_reviewed_by on organizations (reviewed_by);
