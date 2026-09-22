-- 휴대폰 본인인증 결과 (일반 회원 1:1). docs/data-model.md 1절 "identity_verifications"
-- 탈퇴 시 하드 삭제하는 유일한 테이블 (개인정보 즉시 파기). deleted_at 없음
-- 되돌리기: drop table identity_verifications;
create table identity_verifications (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null unique references users (id),
    provider     text not null check (provider in ('pass', 'nice', 'stub')),  -- stub 은 개발용
    ci           text not null,                                               -- PII, 암호화
    ci_hash      text not null unique,                                        -- HMAC-SHA256(ci) (PiiHasher). 한 사람 = 계정 하나
    di           text not null,                                               -- PII, 암호화
    verified_at  timestamptz not null,
    created_at   timestamptz not null,
    updated_at   timestamptz not null
);
