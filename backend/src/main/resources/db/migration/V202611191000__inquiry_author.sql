-- 문의 게시판 작성자 uid (사용자 지시 2026-11-19: 본인 글만 수정·삭제, 관리자(yksoo00)는 삭제 가능).
-- 글·답글에 작성자(trd_user_info.uid)를 저장한다. 외래키 없음(2026-10-27 방침). 화면·API 응답에는 작성자를 내지 않는다.
-- nullable: 이미 있는 글(익명으로 쓴 글)은 작성자가 없다 — 관리자만 지울 수 있고 아무도 수정할 수 없다.
-- 새 컬럼 추가(nullable)라 직전 배포 버전과 호환.
--
-- 되돌리기: alter table trd_inquiry_reply drop column author_uid; alter table trd_inquiry drop column author_uid;
-- 운영 공개 전 이 게시판 테이블을 지우는 마이그레이션이 따로 나간다 (decisions.md 2026-11-18).

alter table trd_inquiry add column author_uid uuid;
alter table trd_inquiry_reply add column author_uid uuid;
