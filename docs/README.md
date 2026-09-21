# 문서 사용법

> 어떤 문서가 있고, 각각 무슨 질문에 답하며, Claude Code 작업 시 언제 `@`로 붙이는지.

## 원칙

- 문서는 글짓기가 아니라 **결정 기록**. "그래서 어떻게 하라는 거야?"가 안 나오게 쓴다.
- 한 문서에 한 질문. 기능 얘기는 prd에, 색 얘기는 design에.
- 모르는 건 "미정"으로 적는다. 빈칸이면 Claude가 알아서 채운다.
- 짧게, 목록으로.

## 문서 목록

| 문서 | 답하는 질문 | 로드 | 상태 |
|---|---|---|---|
| `../CLAUDE.md` | 항상 지킬 규칙, 스택, 명령어 | 자동 | 초안 (버전 TODO) |
| `../.claude/rules/behavior.md` | Claude가 어떻게 일해야 하나 | 자동 | 확정 (Karpathy 원문) |
| `../.claude/rules/{backend,frontend,ai,db}.md` | 언어·영역별 컨벤션 | 해당 경로 작업 시 자동 | 초안 |
| `tasks.md` | 어디까지 했나, 다음은 | 자동 | 계속 갱신 |
| `lessons.md` | Claude가 틀렸던 것 | 자동 | 계속 갱신 |
| `architecture.md` | 뭐가 어디서 돌고 어떻게 연결되나 | `@` 수동 | 거의 확정 |
| `decisions.md` | 왜 그렇게 정했나 | `@` 수동 | 확정, 계속 추가 |
| `ai-api.md` | Spring ↔ ai 계약, 챗봇 조회 함수 | `@` 수동 | 초안 |
| `setup.md` | 새 PC 세팅 | 사람용 | 확정 |
| `prd.md` | 뭘 만들고 뭘 안 만드나 | `@` 수동 | **미작성** |
| `data-model.md` | 어떤 데이터를 저장하나 | `@` 수동 | 1절 계정 초안. 나머지 미작성 |
| `roles.md` | 누가 뭘 할 수 있나 | `@` 수동 | **미작성** |
| `security.md` | 검증·제한·권한 정책 수치 | `@` 수동 | 초안 (기능 의존 부분만 미정) |
| `design.md` | 어떻게 보이나 (색·폰트·간격 숫자로) | `@` 수동 | **미작성** |

## 언제 무엇을 `@`로 붙이나

| 작업 | 붙일 문서 |
|---|---|
| 새 기능 계획 | `@docs/prd.md` |
| 테이블·마이그레이션 | `@docs/data-model.md` |
| 권한 검사 | `@docs/roles.md` |
| 인증·업로드·rate limit·챗봇 함수 | `@docs/security.md` |
| 화면 | `@docs/design.md` |
| Spring ↔ ai 연동 | `@docs/ai-api.md` |
| 배포·compose·인프라 | `@docs/architecture.md` |
| 구조를 바꾸고 싶을 때 | `@docs/decisions.md` (먼저 읽고 반박) |

한 번에 1~3개만. 사소한 수정엔 안 붙여도 된다.

## "왜"를 남기는 곳

| 층 | 어디 |
|---|---|
| 큰 결정 (스택·구조·정책) | `decisions.md` |
| 코드 안의 이유 | 주석 ("무엇"이 아니라 "왜"만) |
| 변경의 이유 | 커밋 메시지 본문 |
| Claude가 틀린 것 | `lessons.md` → 반복되면 규칙으로 승격 |

## 작성 순서 (남은 것)

1. `data-model.md` — users 부분 먼저 (인증 구현용)
2. 기능 정리 받은 후: `prd.md` → `data-model.md` 나머지 → `roles.md` → `security.md`
3. 화면 만들기 전: `design.md`
