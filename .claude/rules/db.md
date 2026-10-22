---
paths:
  - "backend/src/main/resources/db/migration/**"
  - "docs/data-model.md"
---

# DB 마이그레이션 (Flyway)

- 파일명 `V{YYYYMMDDHHMM}__{설명_snake}.sql`. 예: `V202609181030__create_users.sql`.
- 한 파일에 한 목적. 테이블 생성과 데이터 백필을 섞지 않는다.
- 되돌리는 방법을 파일 상단 주석에 적는다 (Flyway 무료 버전은 undo 없음).
- 테이블·컬럼·PK 는 사용자가 준 정의서 물리명(`trd_*`, snake_case 소문자) 그대로. 새 테이블 이름, 정의서와 다른 타입·길이·제약·인덱스는 차이를 표로 보여 주고 사용자 결정을 받는다. 받은 차이는 파일 상단 주석에 적는다 (예: `V202610151000__create_trade_tables.sql`).
- FK에는 인덱스. 조회 조건이 되는 컬럼에도 인덱스. 이미 데이터가 있는 테이블에 인덱스를 더할 땐 `CREATE INDEX CONCURRENTLY` (트랜잭션 밖). 단, 지금 Flyway 기본 설정에선 잠금용 연결이 트랜잭션을 연 채라 concurrently 가 그걸 기다리며 **멈춘다**(2026-10-21 확인). 운영 데이터가 생기기 전엔 일반 `create index` + 파일 주석에 이유, 운영 뒤엔 `spring.flyway.postgresql.transactional-lock=false` 를 먼저 켠다.
- 무중단 호환: 컬럼 추가는 nullable 또는 default. 이름 변경·삭제·NOT NULL 추가는 2회 배포로 분리 (decisions.md 2026-09-17 무중단 배포).
- 마이그레이션을 추가하면 `docs/data-model.md`를 같은 커밋에서 갱신.
- 운영 DB에 콘솔로 직접 스키마 변경 금지.
