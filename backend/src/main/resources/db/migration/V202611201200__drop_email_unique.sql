-- 이메일 유일 제약을 없앤다 (사용자 지시 2026-11-20, decisions.md). 같은 이메일로 계정 여러 개를 만들 수 있다.
-- 로그인 ID·휴대폰·별명(개인)·사업자번호의 유일 제약은 그대로다. 앱의 이메일 중복 확인도 같은 PR 에서 없앴다.
-- 이메일로 계정을 찾는 곳(OAuthLoginService.findByEmail)은 없는 인덱스가 아니라 쿼리라 그대로 돈다 — 다만 이메일이 겹치면 여러 행이 나올 수 있다.
-- 되돌리기: 같은 이메일을 가진 행이 없어야 한다 — create unique index ux_trd_user_info_email on trd_user_info (lower(user_email)) where user_email is not null;
-- 코드(중복 확인 제거)와 같은 배포 단위로 올린다 — 코드만 먼저 올리면 DB 인덱스가 같은 이메일 가입을 막는다.

drop index if exists ux_trd_user_info_email;
