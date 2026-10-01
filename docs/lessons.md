# 배운 것 (Claude가 틀렸던 것)

> 같은 실수가 두 번 나오면 여기 적는다. 세 번이면 `CLAUDE.md` 또는 `.claude/rules/`의 규칙으로 승격하고 여기서는 "→ 규칙으로 승격" 표시만 남긴다.
> 형식: 날짜, 무엇을 틀렸나, 올바른 방법, 어디서 났나.

## 항목

### 2026-09-21 기능 커밋을 main에 직접 함
- 틀림: 이전 세션에서 `feat(frontend): 홈 화면 구현` 등 코드 커밋 3개를 브랜치 없이 main에 직접 커밋. CLAUDE.md에 브랜치 규칙이 첫 커밋부터 있었음.
- 올바름: 코드 변경은 `feat/…` 브랜치에서 커밋 후 머지. 사용자가 "커밋해줘"라고 해도 브랜치 여부를 먼저 확인.
- 어디서: 초기 세팅·홈 화면 (2026-09-18).
- 조치: CLAUDE.md Git 절에 예외 기준(문서만 main 직접)을 명시해 판단 여지를 없앰.

### 2026-09-21 Windows 에서 만든 gradlew 가 실행 권한 없이 커밋됨
- 틀림: `backend/gradlew` 가 100644 로 들어가 CI(Linux) 에서 `Permission denied`. Windows 는 core.filemode 가 꺼져 있어 chmod 가 git 에 안 잡힘.
- 올바름: 스크립트 파일은 `git update-index --chmod=+x <file>` 로 비트를 올리고 `git ls-files -s` 로 100755 확인. CI 에도 `chmod +x` 안전장치.
- 어디서: 첫 CI (PR #3).

### 2026-09-21 CI concurrency 취소가 main 푸시까지 끊음
- 틀림: `cancel-in-progress: true` 를 모든 이벤트에 걸어, 머지가 연달아 되거나 예전 실행을 재실행하면 진행 중인 main 실행이 "canceled" 로 남음. 취소 여부는 **새로 들어오는 실행의 워크플로 파일**이 결정하므로 예전 실행 재실행이 최신 실행을 죽임.
- 올바름: PR 이벤트에서만 취소 (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`). 항상 최신 실행만 보고 예전 실행은 재실행하지 않는다.
- 어디서: PR #5·#6.

### 2026-09-21 `git reset --soft` 로 브랜치를 옮기다 문서 커밋을 되돌림
- 틀림: 커밋 없는 브랜치를 main 위로 옮기려고 `reset --soft main` 후 `git add frontend` 만 하고 커밋. index 에 남아 있던 옛 `docs/` 가 커밋에 딸려 들어가 직전 문서 커밋을 되돌림.
- 올바름: 브랜치는 **커밋 직전에** main 에서 새로 만든다 (`git checkout -b feat/x main`). 이미 만든 브랜치를 옮겨야 하면 `git rebase main`. 커밋 전 `git status` 로 의도한 파일만 staged 인지 확인.
- 어디서: feat/login 커밋. 푸시 전이라 이력을 다시 써서 복구.

### 2026-09-29 프론트 태스크 검증에서 typecheck만 돌리고 lint를 빼먹음
- 틀림: 타일 워크스페이스 구현(subagent-driven) Task 2에서 구현자·리뷰어 둘 다 `pnpm typecheck`만 돌리고 `pnpm lint`를 안 돌려서, 실제 ESLint error(`react-hooks/set-state-in-effect`)가 통과됨. 다음 태스크 리뷰어가 우연히 lint를 돌려서야 발견.
- 올바름: 프론트 코드 검증은 typecheck와 lint를 **항상 같이** 돌린다. CLAUDE.md 커밋 전 체크리스트에 이미 `pnpm typecheck && pnpm lint && pnpm test`가 명시돼 있었는데도 태스크 단위 검증에서 lint를 생략한 게 원인.
- 어디서: `feat/tile-workspace` Task 2~3 (2026-09-29).

### 2026-10-01 사용자가 준 요구 화면(이미지)을 임의로 줄이거나 바꿈
- 틀림: 검색 결과 화면에서 (1) 이미지 두 장 중 하나를 "레거시 예시"로 가정해 열 7개를 빠뜨렸고, (2) 다시 넣으면서 수량·단가를 앞으로 당기고 유무(O/X) 열을 값(글자)으로 바꿨다. 가정을 말하긴 했지만 확인 없이 진행했다.
- 올바름: 사용자가 준 화면 이미지는 열·순서·표시 방식(O/X 등)까지 요구사항이다. 그대로 구현하고, 더 나은 배치가 있다고 생각하면 바꾸기 전에 묻는다. 이미지가 여러 장이면 어느 것이 무엇인지 먼저 확인한다.
- 어디서: `feat/search-results` (PR #23).
