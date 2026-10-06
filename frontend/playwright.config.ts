import { defineConfig } from "@playwright/test";

// 핵심 흐름 E2E (frontend.md "Playwright: 핵심 흐름 최소 1개"). 백엔드·Postgres·Redis 가 떠 있어야 한다:
//   docker compose up -d && (cd backend && ./gradlew bootRun)  → pnpm e2e
// CI 에는 아직 없음 (백엔드 스택을 띄워야 해서 워크플로가 커진다 — decisions.md 2026-10-06 Playwright)
export default defineConfig({
  testDir: "./e2e",
  // 가입은 IP 당 시간당 5회 제한이라 병렬·재시도로 한도를 깎지 않는다
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // 브라우저를 따로 받지 않고 Windows 에 깔린 Edge 를 쓴다 (이 개발 PC 는 Playwright 브라우저 다운로드가 막힘).
    // TODO(CI 추가 시): 리눅스 러너엔 Edge 가 없으니 chromium 으로 바꾸고 `playwright install chromium` 단계를 넣는다
    channel: "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // 떠 있는 개발 서버가 있으면 그대로 쓰고, 없으면 띄운다
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
