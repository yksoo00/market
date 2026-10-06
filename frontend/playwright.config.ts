import { defineConfig } from "@playwright/test";

// 브라우저: 기본은 Windows 에 깔린 Edge (이 개발 PC 는 Playwright 브라우저 다운로드가 막힘).
// 다른 PC·CI 는 E2E_CHANNEL=chromium(내려받은 Chromium, `playwright install chromium` 필요)이나 chrome 등으로 바꾼다
const channel = process.env.E2E_CHANNEL ?? "msedge";

// 핵심 흐름 E2E (frontend.md "Playwright: 핵심 흐름 최소 1개"). 백엔드·Postgres·Redis 가 떠 있어야 한다:
//   docker compose up -d && (cd backend && ./gradlew bootRun)  → pnpm e2e
// CI 에는 아직 없음 (백엔드 스택을 띄워야 해서 워크플로가 커진다 — decisions.md 2026-10-06 Playwright)
export default defineConfig({
  testDir: "./e2e",
  // 가입은 IP 당 시간당 5회 제한이라 병렬·재시도로 한도를 깎지 않는다
  workers: 1,
  retries: 0,
  timeout: 60_000,
  // 개발 서버는 화면을 처음 요청할 때 컴파일한다 — 기본 5초면 차가운 서버에서 이동 확인이 먼저 끝나 가입 한도만 깎는다
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: channel === "chromium" ? undefined : channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // 떠 있는 개발 서버가 있으면 그대로 쓰고, 없으면 띄운다. 의존성을 바꾼(pnpm install) 뒤엔 떠 있던 서버가 옛 경로를 봐 500 이 나므로 다시 띄울 것
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
