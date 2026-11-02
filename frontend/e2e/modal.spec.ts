import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { signup } from "@/messages/signup";
import { trade } from "@/messages/trade";

// 모달 위치 통일 (2026-11-02): 어느 칸에서 열든 모달은 창 가운데. 보조 칸(iframe)의 상세에서 [구매]를 눌러도
// 그 칸 안이 아니라 창 가운데에 뜬다. 가입 1번 + 로그인
const password = "Test1234!@";

const checkButton = (page: Page, name: string) =>
  page.locator(`input[name="${name}"]`).locator("xpath=ancestor::div[.//button][1]").getByRole("button", { name: signup.form.check });

test("보조 칸 상세에서 구매 모달이 창 가운데에 뜨고, 닫으면 칸이 원래대로", async ({ page }) => {
  const stamp = Date.now().toString();
  const loginId = `e2em${stamp.slice(-8)}`;
  const phone8 = stamp.slice(-8);
  await page.setViewportSize({ width: 1400, height: 800 });

  await page.goto("/signup/personal/form");
  await page.getByRole("button", { name: auth.verify.button }).click();
  await expect(page.getByText(signup.verify.done)).toBeVisible();
  await page.locator('input[name="name"]').fill("홍길동");
  await page.locator('input[name="loginId"]').fill(loginId);
  await checkButton(page, "loginId").click();
  await expect(page.getByText(signup.form.available.loginId)).toBeVisible();
  await page.locator('input[name="emailLocal"]').fill(loginId);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="passwordConfirm"]').fill(password);
  await page.locator('input[name="phoneMid"]').fill(phone8.slice(0, 4));
  await page.locator('input[name="phoneLast"]').fill(phone8.slice(4, 8));
  await page.getByRole("checkbox", { name: signup.terms.all }).click();
  await page.getByRole("button", { name: signup.form.submit }).click();
  await expect(page.getByRole("dialog", { name: signup.result.title })).toBeVisible();

  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill(loginId);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: auth.login.submit, exact: true }).click();
  await expect(page.getByRole("button", { name: my.menu.label })).toBeVisible();

  // 검색(주기능) → 첫 결과를 누르면 상세가 보조 칸(iframe)에 뜬다 (다른 사용자가 올린 매물이 있어야 한다 — 개발 DB 의 기존 매물)
  await page.goto("/search");
  await page.locator("table tbody tr").first().getByRole("link").first().click();
  const frame = page.frameLocator("iframe").last();
  await frame.getByRole("button", { name: listing.detail.buy, exact: true }).click();

  const dialog = frame.getByRole("dialog", { name: trade.purchase.title });
  await expect(dialog).toBeVisible();
  // 모달 가운데가 창 가운데 (보조 칸은 오른쪽 아래라 칸 안이면 창 중심에서 한참 벗어난다)
  const box = (await dialog.boundingBox())!;
  const iframeBox = (await page.locator("iframe").last().boundingBox())!;
  expect(Math.abs(iframeBox.x)).toBeLessThan(2);
  expect(Math.abs(iframeBox.width - 1400)).toBeLessThan(2);
  expect(Math.abs(box.x + box.width / 2 - 700)).toBeLessThan(4);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await page.locator("iframe").last().boundingBox())!.width).toBeLessThan(900);
});
