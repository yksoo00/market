import { expect, test } from "@playwright/test";
import { inquiry as t } from "@/messages/inquiry";

// 익명 문의 게시판 흐름 (스펙 2026-11-18-inquiry-board-design.md): 로그인 없이 글 작성 → 목록에 보임 → 상세에서 답글 작성 → 보임.
// 본문의 <script> 는 실행되지 않고 글자로 보여야 한다. 좁은 화면(휴대폰)으로 돌려 분할 칸(iframe)이 끼지 않게 한다 —
// 넓은 화면의 칸 배치는 수동으로 확인한다.
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
