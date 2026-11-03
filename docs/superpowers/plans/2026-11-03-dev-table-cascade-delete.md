# 임시 테이블 삭제는 딸린 행도 같이 지운다 (2026-11-03)

## 설계
사용자 지시: 임시 테이블(`/dev/tables`)에서 [삭제]를 누르면 그 행과 관련된 다른 테이블의 행도 같이 지운다 — 외래키가 없어 하나하나 비교하며 지우기 귀찮아서. 로컬 전용 도구(`APP_ENV=local`)라 서비스 규칙을 거치지 않는 기존 방침 그대로.

### 규칙 (`DevTableRelations`, 부모 → 자식 방향만, 자식 → 부모는 안 지운다)
- 사용자(`uid`) → 매물(`user_id`), 거래·장바구니 정보·거래이력(구매자 `user_id` 또는 판매자 `seller_id`)
- 상품마스터(`prod_id`) → 매물·거래·거래이력(`prod_id`), 장바구니 정보(`prod_no`)
- 매물(`user_id`·`reg_date`·`prod_id`) → 그 매물의 거래(`seller_id`·`prod_reg_date`·`prod_id`)·장바구니 정보(`seller_id`·`prod_date`·`prod_no`)
- 거래(`user_id`·`trade_id`) → 장바구니 정보·거래이력
- 카테고리(`category_code`) → 아래 단계 카테고리(`parent_code`)와 그 카테고리의 상품마스터(대·중·소 조각)
- 자식의 자식까지 따라간다(예: 사용자 → 매물 → 거래 → 거래이력). 같은 행은 한 번만. 한 번에 2만 행을 넘으면 거절(관계를 잘못 타고 번지는 것 방지).

### API·화면
- `POST /api/v1/dev/tables/{table}/rows/related` (PK 본문) → `{ related: { 테이블: 행 수 } }` — 이 행 자신은 빼고, 0 은 뺀 미리보기. 아무것도 안 지운다.
- `DELETE /api/v1/dev/tables/{table}/rows` → 한 트랜잭션에서 자식 행 + 이 행을 지운다. 응답 `{ deleted: 합계, tables: { 테이블: 지운 행 수 } }`.
- 화면: [삭제] → 미리보기 → 확인창에 "딸린 다른 테이블의 행도 같이 지워져요: trd_prod_reg: 3행 …"(없으면 "딸린 행은 없어요") → [삭제] → 지운 테이블별 행 수를 결과 알림에 표시.

### 영향 검토
- 엑셀 불러오기·생성·수정은 그대로. 운영 경로 없음(빈이 `app.env=local` 에서만 생김).
- DB 외래키는 2026-10-27 에 없앴고(정의서는 의미상 관계) 이 규칙표가 그 의미상 관계를 코드로 옮긴 것 — 정의서가 바뀌면 같이 고친다.

## 작업
1. 백엔드: `DevTableRelations`, `DevTableService.delete`(연쇄)·`relatedRows`, 컨트롤러. `DevTableCascadeTest`(매물·거래·거래이력·사용자 삭제 시나리오, 미리보기는 안 지움, 없는 행 404).
2. 프론트: `fetchRelatedDevRows`, 삭제 흐름(미리보기 → 확인창), 문구.
3. docs(`decisions.md`) → `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, PR → `/code-review`.
