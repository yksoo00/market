---
paths:
  - "backend/src/main/resources/db/migration/**"
  - "docs/data-model.md"
---

# DB 마이그레이션 (Flyway)

- 파일명 `V{YYYYMMDDHHMM}__{설명_snake}.sql`. 예: `V202609181030__create_users.sql`.
- 한 파일에 한 목적. 테이블 생성과 데이터 백필을 섞지 않는다.
- 되돌리는 방법을 파일 상단 주석에 적는다 (Flyway 무료 버전은 undo 없음).
- 테이블명 snake_case 복수형. PK `id uuid default gen_random_uuid()`. `created_at`, `updated_at timestamptz not null`.
- soft delete 대상 테이블은 `deleted_at timestamptz null` + 부분 인덱스 `where deleted_at is null`.
- FK에는 인덱스. 조회 조건이 되는 컬럼에도 인덱스. 인덱스 추가는 `CREATE INDEX CONCURRENTLY` (트랜잭션 밖).
- `listings`: `seller_user_id`/`seller_org_id` 중 정확히 하나 — CHECK 제약으로 강제.
- 무중단 호환: 컬럼 추가는 nullable 또는 default. 이름 변경·삭제·NOT NULL 추가는 2회 배포로 분리 (decisions.md 2026-09-17 무중단 배포).
- 마이그레이션을 추가하면 `docs/data-model.md`를 같은 커밋에서 갱신.
- 운영 DB에 콘솔로 직접 스키마 변경 금지.
