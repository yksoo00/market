-- 사내 테스트용 익명 문의 게시판 (스펙 docs/superpowers/specs/2026-11-18-inquiry-board-design.md).
-- 글 trd_inquiry 와 답글 trd_inquiry_reply. 작성자(uid·IP)를 저장하지 않는다.
--
-- 정의서 밖 보조 테이블 (사용자 승인 2026-11-18): 이름·컬럼은 사용자와 정했다.
-- 외래키 없음 — 2026-10-27 방침. 글 존재 여부는 서버가 확인한다.
-- 새 테이블 추가라 직전 배포 버전과 호환. 인덱스도 빈 새 테이블이라 일반 create index (concurrently 불필요).
--
-- 되돌리기: drop table trd_inquiry_reply; drop table trd_inquiry;
-- 운영 공개 전에 이 테이블들을 지우는 마이그레이션을 새로 낸다 (decisions.md 2026-11-18).

create table trd_inquiry (
    id          uuid          primary key,
    title       varchar(100)  not null,
    content     varchar(2000) not null,
    created_at  timestamptz   not null,
    updated_at  timestamptz   not null
);

-- 목록: 최신순 커서 (created_at, id)
create index ix_trd_inquiry_created on trd_inquiry (created_at desc, id desc);

create table trd_inquiry_reply (
    id          uuid          primary key,
    inquiry_id  uuid          not null,
    content     varchar(1000) not null,
    created_at  timestamptz   not null,
    updated_at  timestamptz   not null
);

-- 글 상세: 그 글의 답글을 오래된 순으로
create index ix_trd_inquiry_reply_inquiry on trd_inquiry_reply (inquiry_id, created_at);
