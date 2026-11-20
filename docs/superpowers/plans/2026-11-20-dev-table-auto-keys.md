# 임시 테이블 자동 키·시각 채우기 — 설계와 계획

사용자 지시(2026-11-20). 임시 테이블(`app.env=local` 전용 개발 도구)은 백엔드 서비스를 거치지 않고 DB 에 직접 넣어서, 백엔드가 자동으로 채우던 칸을 비우면 NOT NULL 오류가 났다. 서비스가 채우던 규칙을 임시 테이블에도 적용한다. 스키마(DB 기본값)는 바꾸지 않는다 — 서비스 코드만.

## 설계

### 1. 규칙 (생성할 때. 값이 와도 무시하고 항상)
| 테이블.칸 | 규칙 |
|---|---|
| `trd_user_info.uid` | 새 uid (`UP`+yyMMdd+3자리, 이미 구현됨 `nextUid`) |
| `trd_user_info.dt_reg`, `dt_update` | 지금 시각(UTC — 백엔드 `User`·서비스 clock 과 같다) |
| `trd_ctgr_code`·`trd_ctgr_master`·`trd_prod_master`.`reg_date` | 지금 시각(UTC) |
| `trd_prod_master.prod_id` | 새 `KP-연도-6자리` (상품 서비스 규칙, 해마다 1부터) |
| `trd_prod_reg.reg_date` | 지금 시각(UTC). 같은 키(사용자·상품)가 이미 있으면 1초씩 늦춘다 |
| `trd_trade_info.trade_id`, `reg_date` | 새 거래ID(한국 시간 `yyMMddHH`+시간대 순번 3자리, `TradeIdGenerator` 규칙), 지금 시각 |
| `trd_cart_info.ser_no`, `reg_date` | 사용자별 최댓값+1, 지금 시각 |

- 사용자가 직접 넣는다(기본값 없음): `trade_stats`, `prod_state`, `trade_type`. 비우면 지금처럼 NOT NULL 오류.
- 그대로 입력 받는다: 카테고리 코드·이름, `trd_trade_history.trade_date`(확정일시라 의미 있는 값), 가격·수량·이름 등 나머지. `trd_prod_reg.dt_update` 는 생성 때 비워 둔다(백엔드와 같다).

### 2. 수정할 때
- `trd_user_info.dt_update`, `trd_prod_reg.dt_update` 는 값이 와도 무시하고 지금 시각으로 갱신 (백엔드: 사용자 `@PreUpdate`, 매물 `applyUpdate`). `dt_reg`·`reg_date` 와 키는 바뀌지 않는다(키는 이미 읽기 전용).

### 3. 참조 맞추기
- 주 PK 를 새로 만들면 그 키를 가리키는 칸을 같이 맞춘다. 참조 표는 `DevTableRelations` 가 이미 갖고 있는 의미상 관계를 쓴다.

| 부모 키 | 가리키는 칸 |
|---|---|
| 사용자 `uid` | `trd_prod_reg.user_id`, `trd_trade_info.user_id·seller_id`, `trd_cart_info.user_id·seller_id`, `trd_trade_history.user_id·seller_id` |
| 상품마스터 `prod_id` | `trd_prod_reg.prod_id`, `trd_trade_info.prod_id`, `trd_trade_history.prod_id`, `trd_cart_info.prod_no` |
| 매물 `(user_id, reg_date, prod_id)` → 새 `reg_date` | `trd_trade_info.prod_reg_date`, `trd_cart_info.prod_date` (판매자·상품 값도 같이 새 키로 찾는다) |
| 거래 `(user_id, trade_id)` → 새 `trade_id` | `trd_cart_info.trade_id`, `trd_trade_history.trade_id` |

- **엑셀 여러 시트를 한 번에**(`importAll`): 의존 순서(사용자 → 카테고리 → 상품마스터 → 매물 → 거래 → 장바구니 → 거래이력)로 처리하고, 부모 행마다 `엑셀의 옛 키 → 새 키` 대응표를 만든다. 자식의 참조 칸 값은 ① 대응표에 있으면 새 키로 바꾸고 ② 없으면 DB 에 그 키가 있는지 보고 있으면 그대로 ③ 둘 다 없으면 오류. 대응표가 DB 보다 먼저다(엑셀의 옛 uid 가 DB 에 이미 있는 다른 사용자의 uid 와 같아도 같은 파일의 부모를 따른다).
- **시트 하나(`importTable`)·폼으로 한 줄**: 대응표가 없으니 참조 칸 값을 그대로 쓰고 DB 에 있는지만 검사한다.
- 응답에 `옛 키 → 새 키` 목록을 같이 돌려주고 화면 결과 창에 보여 준다(다른 시트의 참조를 나중에 맞출 수 있게).

### 4. 오류 (한글, 위치까지)
- 가져오기·폼이 모두 한 트랜잭션이라 오류가 나면 아무것도 저장하지 않는다.
- 형식: `시트 '거래', 5행 prod_id: '규칙-01' 에 해당하는 상품마스터가 같은 파일에도 DB에도 없습니다.` (폼은 시트·행 없이 칸 이름과 값). 부모 이름은 사용자·상품마스터·매물·거래 한글 이름, 칸 이름은 `DevTableAliases` 의 정의서 한글명이 있으면 같이 적는다.
- 영어 DB 오류 문구는 그대로 내지 않는다 — 알려진 NOT NULL·형식 오류는 칸 이름과 값을 한글로 바꿔 준다(기존 `bad(...)` 문구 유지).

### 5. 같은 초 충돌
- 매물 키(`user_id + reg_date + prod_id`)가 겹치면(같은 파일 안 또는 DB) `reg_date` 를 1초씩 늦춰 빈 값을 찾는다. 겹칠 때만 늦춘다(사용자: "이때는 초가 좀 달라지게"). 시각이 실제와 조금 어긋나는 것은 감수.

### 6. 정하지 않은 것 / 감수
- 시각은 UTC 로 넣는다 — 백엔드가 `User`·서비스 clock(UTC)로 저장하는 것과 같다. 거래ID 만 한국 시간(`TradeIdGenerator`)이다.
- 대응표는 한 번의 가져오기 안에서만 산다 — 따로 가져온 두 파일 사이의 참조는 못 맞춘다(화면에 보여 준 `옛→새` 목록으로 직접 맞춘다).
- 같은 파일에 옛 키가 중복이면(예: 같은 `trade_id` 두 행) 마지막 행의 새 키가 대응표를 덮어쓴다 — 오류로 막지 않는다.

## 작업 (PR 1개, `dev` 대상, 머지는 사용자)

1. `DevKeyRules`(칸 규칙 표) + 할당기: 지금 시각·`prod_id`·`trade_id`·`ser_no`·`reg_date` 충돌 회피. 단위·통합 테스트 먼저 (번호 규칙, 충돌 시 +1초, 거래ID 시간대 순번).
2. `DevTableService.insert`: 위 규칙을 적용(값이 와도 무시). 참조 칸이 DB 에 있는지 검사하고 없으면 한글 오류.
3. `importTable`/`importAll`: 의존 순서·대응표·참조 바꾸기·오류에 시트와 행 번호. `ImportResult` 에 키 대응 목록 추가.
4. `DevTableService.update`: `dt_update` 갱신 규칙.
5. 프론트: 생성 폼에서 자동으로 채워지는 칸을 숨김(지금 `uid` 만 숨김 → 규칙 표 기준), 가져오기 결과에 `옛→새` 목록, 한글 문구는 `messages/dev.ts`.
6. 문서: `decisions.md`·bruno(`dev/import-*`) 갱신.

검증: `./gradlew test --tests '*DevTable*'` + 전체 `check`, `pnpm typecheck && pnpm lint && pnpm test`. 새 API 가 아니라 기존 임시 테이블 API 의 동작 변경이라 `/security-review` 는 생략(인증·권한·스키마 변경 없음).
