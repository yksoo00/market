-- 약관 동의 기록. 수정하지 않고 철회는 새 행. 탈퇴해도 유지 (증빙). docs/data-model.md 1절 "terms_agreements"
-- 되돌리기: drop table terms_agreements;
create table terms_agreements (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references users (id),
    terms_id    text not null check (terms_id in ('service', 'privacy', 'age', 'marketing', 'business')),
    version     text not null,                                   -- 약관 시행일 YYYY-MM-DD
    agreed      boolean not null,                                -- 선택 항목 미동의도 기록
    agreed_at   timestamptz not null,
    ip          inet,                                            -- 증빙용. 90일 후 null
    created_at  timestamptz not null,
    updated_at  timestamptz not null
);

-- 유일 제약 없음: 같은 버전에 동의 → 철회(agreed=false) 가 새 행으로 쌓인다. 현재 상태는 agreed_at 최신 행
create index ix_terms_agreements_user_terms on terms_agreements (user_id, terms_id);
