import { expect, test, type Page } from "@playwright/test";
import { home } from "@/messages/home";

// 아래 탭바는 폰(화면 768 미만)에서만. PC 분할의 좁은 주기능 칸(768 미만)에서도 숨는다 — 칸 폭 기준이던 버그 (2026-10-22)
// 백엔드 없이도 돈다 (검색 결과가 "불러오지 못했어요"여도 칸 배치는 같다)
const tab = (page: Page) => page.getByRole("link", { name: home.tabs.post, exact: true });

test.describe("PC 분할", () => {
  test.use({ viewport: { width: 1500, height: 800 } });

  test("홈 | 검색 2분할에서 좁은 검색 칸에도 탭바가 없다", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(home.search.placeholder).fill("R740");
    await page.getByPlaceholder(home.search.placeholder).press("Enter");
    // 칸 규칙: 홈은 iframe 칸, 주기능(검색)은 주소창 문서 (frontend.md)
    await expect(page.locator('iframe[src="/"]')).toHaveCount(1);
    await expect(page).toHaveURL(/\/search/);
    await expect(tab(page)).toBeHidden();
  });
});

test.describe("폰", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("탭바가 보인다", async ({ page }) => {
    await page.goto("/");
    await expect(tab(page)).toBeVisible();
  });
});
