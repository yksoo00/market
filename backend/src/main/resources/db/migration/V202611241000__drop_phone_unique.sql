-- 휴대폰 유일 제약을 없앤다 (사용자 지시 2026-11-24, decisions.md). 같은 휴대폰 번호로 계정 여러 개를 만들 수 있다.
-- 로그인 ID·별명(개인)·사업자번호의 유일 제약은 그대로다. 앱의 휴대폰 중복 확인(DUPLICATE_PHONE)도 같은 PR 에서 없앴다.
-- 되돌리기: 같은 휴대폰을 가진 행이 없어야 한다 — create unique index ux_trd_user_info_phone on trd_user_info (user_phone) where user_phone is not null;
-- 코드(중복 확인 제거)와 같은 배포 단위로 올린다 — 코드만 먼저 올리면 DB 인덱스가 같은 휴대폰 가입을 막는다.

drop index if exists ux_trd_user_info_phone;
