import { expect, test } from "@playwright/test";
import { inquiry as t } from "@/messages/inquiry";

// 익명 문의 게시판 흐름 (스펙 2026-11-18-inquiry-board-design.md): 로그인 없이 글 작성 → 목록에 보임 → 상세에서 답글 작성 → 보임.
// 본문의 <script> 는 실행되지 않고 글자로 보여야 한다. 흐름 확인은 좁은 화면(휴대폰)으로 돌려 분할 칸(iframe)이 끼지 않게 하고,
// 넓은 화면에서는 칸 배치(홈 | 문의 | 상세)만 따로 확인한다.
test.describe("좁은 화면", () => {
test.use({ viewport: { width: 390, height: 844 } });

test("로그인 없이 문의를 쓰고 답글을 단다", async ({ page }) => {
  const title = `문의-${Date.now()}`;
  const script = "<script>window.__inq=1</script>";
  const reply = `답글-${Date.now()}`;

  await page.goto("/inquiries");
  await page.getByRole("textbox", { name: t.form.title, exact: true }).fill(title);
  await page.getByRole("textbox", { name: t.form.content, exact: true }).fill(`${script}\n두 번째 줄`);
  await page.getByRole("button", { name: t.form.submit, exact: true }).click();

  const link = page.getByRole("link", { name: new RegExp(title) });
  await expect(link).toBeVisible();
  await link.click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(script)).toBeVisible();
  expect(await page.evaluate(() => "__inq" in window)).toBe(false);

  await page.getByRole("textbox", { name: t.reply.content, exact: true }).fill(reply);
  await page.getByRole("button", { name: t.reply.submit, exact: true }).click();
  await expect(page.getByText(reply)).toBeVisible();
  await expect(page.getByRole("heading", { name: t.detail.repliesHeading(1) })).toBeVisible();
});
});

test.describe("넓은 화면", () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  // 문의는 공통 화면이라 주기능 옆에서 열면 보조 칸(iframe)으로 뜬다: [홈 | 문의 | 상세]
  test("목록에서 글을 열면 상세가 옆 칸에 뜬다", async ({ page }) => {
    const title = `문의-wide-${Date.now()}`;
    await page.goto("/inquiries");
    await expect(page.locator('iframe[src="/"]')).toBeVisible();
    await page.getByRole("textbox", { name: t.form.title, exact: true }).fill(title);
    await page.getByRole("textbox", { name: t.form.content, exact: true }).fill("내용");
    await page.getByRole("button", { name: t.form.submit, exact: true }).click();
    await page.getByRole("link", { name: new RegExp(title) }).click();

    const detail = page.frameLocator('iframe[src^="/inquiries/"]');
    await expect(detail.getByRole("heading", { name: title })).toBeVisible();
    // 목록(주기능)은 그대로 남아 있다
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  });
});
