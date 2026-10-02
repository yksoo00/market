# Bruno 컬렉션

Bruno 앱에서 이 폴더를 "Open Collection" 으로 연다. 환경은 `environments/local.bru` — 비밀값(`adminPassword` 등)은 앱 안에서만 채우고 파일에 쓰지 않는다.

- 인증은 쿠키. 로그인 요청 뒤 Bruno 가 쿠키를 자동으로 들고 다니므로 `users/me` 등은 바로 호출된다.
- 폴더는 도메인별 (`auth/`, `users/`, `listings/`, `uploads/` …). 새 API 를 만들면 같은 PR 에서 요청 파일도 추가 (rules/backend.md).
