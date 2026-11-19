import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { inquiry as t } from "@/messages/inquiry";
import { my } from "@/messages/my";
import { signup } from "@/messages/signup";

// 문의 게시판 흐름 (스펙 2026-11-18-inquiry-board-design.md, 2026-11-19 수정·삭제): 읽기는 로그인 없이, 쓰기는 로그인.
// 로그인 → 글 작성 → 목록에 보임 → 상세에서 답글 작성·글 수정·글 삭제. 본문의 <script> 는 실행되지 않고 글자로 보여야 한다.
// 흐름 확인은 좁은 화면(휴대폰)으로 돌려 분할 칸(iframe)이 끼지 않게 하고, 넓은 화면에서는 칸 배치(홈 | 문의 | 상세)만 따로 확인한다.
const password = "Test1234!@";

const checkButton = (page: Page, name: string) =>
  page.locator(`input[name="${name}"]`).locator("xpath=ancestor::div[.//button][1]").getByRole("button", { name: signup.form.check });

// 같은 개발 DB 를 쓰므로 실행마다 겹치지 않는 아이디·휴대폰 번호를 쓴다
function uniqueUser() {
  const n = Date.now();
  return { loginId: `inq${String(n).slice(-9)}`, phone8: String(n).slice(-8) };
}

async function signUp(page: Page, loginId: string, phone8: string) {
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
}

async function logIn(page: Page, loginId: string) {
  await page.goto("/login");
  await page.locator('input[name="loginId"]').fill(loginId);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: auth.login.submit, exact: true }).click();
  await expect(page.getByRole("button", { name: my.menu.label })).toBeVisible();
}

async function write(page: Page, title: string, content: string) {
  await page.goto("/inquiries");
  await page.getByRole("textbox", { name: t.form.title, exact: true }).fill(title);
  await page.getByRole("textbox", { name: t.form.content, exact: true }).fill(content);
  await page.getByRole("button", { name: t.form.submit, exact: true }).click();
}

test.describe("좁은 화면", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("로그인한 사람이 문의를 쓰고 답글·수정·삭제를 한다", async ({ page }) => {
    const { loginId, phone8 } = uniqueUser();
    await signUp(page, loginId, phone8);
    await logIn(page, loginId);

    const title = `문의-${Date.now()}`;
    const script = "<script>window.__inq=1</script>";
    const reply = `답글-${Date.now()}`;
    await write(page, title, `${script}\n두 번째 줄`);

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

    // 본인 글 수정
    await page.getByRole("button", { name: t.detail.edit }).first().click();
    const edited = `${title}-수정`;
    await page.getByRole("textbox", { name: t.form.title, exact: true }).fill(edited);
    await page.getByRole("button", { name: t.form.save, exact: true }).click();
    await expect(page.getByRole("heading", { name: edited })).toBeVisible();

    // 본인 글 삭제 (확인 창 수락)
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: t.detail.delete }).first().click();
    await expect(page.getByText(t.detail.deleted)).toBeVisible();
  });

  test("로그인하지 않으면 읽을 수는 있지만 쓰면 로그인 안내가 뜬다", async ({ page }) => {
    await write(page, `익명-${Date.now()}`, "내용");
    await expect(page.getByText(t.form.loginRequired)).toBeVisible();
  });
});

test.describe("넓은 화면", () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  // 문의는 공통 화면이라 주기능 옆에서 열면 보조 칸(iframe)으로 뜬다: [홈 | 문의 | 상세]
  test("목록에서 글을 열면 상세가 옆 칸에 뜬다", async ({ page }) => {
    const { loginId, phone8 } = uniqueUser();
    await signUp(page, loginId, phone8);
    await logIn(page, loginId);

    const title = `문의-wide-${Date.now()}`;
    await write(page, title, "내용");
    await expect(page.locator('iframe[src="/"]')).toBeVisible();
    await page.getByRole("link", { name: new RegExp(title) }).click();

    const detail = page.frameLocator('iframe[src^="/inquiries/"]');
    await expect(detail.getByRole("heading", { name: title })).toBeVisible();
    // 목록(주기능)은 그대로 남아 있다
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  });
});
