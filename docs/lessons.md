# 배운 것 (Claude가 틀렸던 것)

> 같은 실수가 두 번 나오면 여기 적는다. 세 번이면 `CLAUDE.md` 또는 `.claude/rules/`의 규칙으로 승격하고 여기서는 "→ 규칙으로 승격" 표시만 남긴다.
> 형식: 날짜, 무엇을 틀렸나, 올바른 방법, 어디서 났나.

## 예시 (실제 항목이 생기면 지울 것)

### 2026-09-18 Spring Boot 2.x 방식의 Security 설정
- 틀림: `WebSecurityConfigurerAdapter`를 상속한 설정 클래스 생성. 3.x에서 제거됨.
- 올바름: `SecurityFilterChain` 빈 등록.
- 어디서: 인증 초기 구현.
- → CLAUDE.md "표에 없는 버전의 API·문법을 쓰지 않는다"로 이미 규칙 있음. 반복되면 backend.md에 구체 예시 추가.

---

## 항목
(아직 없음)
