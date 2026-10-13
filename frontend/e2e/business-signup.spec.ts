import { expect, test } from "@playwright/test";
import { auth } from "@/messages/auth";
import { my } from "@/messages/my";
import { signup } from "@/messages/signup";

// 기업 가입(한 페이지: 담당자 → 계정 → 사업자번호 조회·회사 정보 → 약관) → 완료 팝업 → 기업 탭 아이디 로그인.
// 사업자번호 조회는 로컬 개발 환경에서만 통과한다(임시 조회). 실행마다 가입 1회 — IP 당 시간당 5회 한도를 flow.spec 과 같이 쓴다
test("기업 가입 → 기업 탭에서 아이디로 로그인", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const loginId = `biz${stamp}`;
  const password = "Test1234!@";
  // 10자리, 실행마다 다르게 (사업자번호당 계정 1개)
  const bizNo = `9${stamp}0`;
  const m = signup.business.form;

  // 로그인 화면에서 [회원가입]을 누르면 가입은 옆 칸(iframe)에 열린다 (타일 큐). 가입은 그 칸 안에서 한다
  const f = page.frameLocator('iframe[src="/signup/business/form"]');

  await test.step("로그인 기업 탭의 [회원가입]으로 옆 칸에 기업 가입", async () => {
    await page.goto("/login?type=business");
    await page.getByRole("tabpanel", { name: auth.tabs.business }).getByRole("link", { name: auth.login.signup }).click();
    await expect(f.locator('input[name="contactName"]')).toBeVisible();
  });

  await test.step("담당자·계정·회사 정보·약관을 넣고 가입", async () => {
    await f.locator('input[name="contactName"]').fill("김담당");
    await f.locator('input[name="phoneMid"]').fill(stamp.slice(0, 4));
    await f.locator('input[name="phoneLast"]').fill(stamp.slice(4, 8));
    await f.locator('input[name="emailLocal"]').fill(loginId);
    await f.locator('input[name="loginId"]').fill(loginId);
    await f.locator('input[name="loginId"]').locator("xpath=ancestor::div[.//button][1]").getByRole("button", { name: signup.form.check }).click();
    await expect(f.getByText(signup.form.available.loginId)).toBeVisible();
    await f.locator('input[name="password"]').fill(password);
    await f.locator('input[name="passwordConfirm"]').fill(password);

    const submit = f.getByRole("button", { name: m.submit });
    await f.locator('input[name="bizNo"]').fill(bizNo);
    await f.getByRole("button", { name: m.lookup, exact: true }).click();
    await expect(f.getByText(m.lookupDone)).toBeVisible();
    await f.locator('input[name="companyName"]').fill("테스트상사");
    await f.locator('input[name="address"]').fill("서울 중구 세종대로 110");
    await expect(submit).toBeDisabled();
    await f.getByRole("checkbox", { name: signup.terms.all }).click();
    await expect(submit).toBeEnabled();
    await submit.click();

    const done = f.getByRole("dialog", { name: signup.result.businessTitle });
    await expect(done).toBeVisible();
    await done.getByRole("button", { name: signup.result.toLogin }).click();
    // 가입 칸이 닫히고 기업 탭 로그인 화면만 남는다
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page).toHaveURL(/\/login\?type=business$/);
  });

  await test.step("기업 탭에서 아이디로 로그인", async () => {
    await page.locator('input[name="loginId"]').fill(loginId);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: auth.login.submit, exact: true }).click();
    await expect(page.getByRole("button", { name: my.menu.label })).toBeVisible();
  });
});
