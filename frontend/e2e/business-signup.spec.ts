import { expect, test } from "@playwright/test";
import { auth } from "@/messages/auth";
import { home } from "@/messages/home";
import { signup } from "@/messages/signup";
import { my } from "@/messages/my";

// 기업 가입(한 페이지) → 완료 팝업 → 기업 탭 아이디 로그인. 사업자번호 조회는 로컬 개발 환경에서만 통과한다(임시 조회).
// 헤더 [로그인] → 홈 | 로그인(주기능 칸 = 주소창). [회원가입]을 누르면 칸이 늘지 않고 그 칸이 가입으로 바뀐다
// (로그인·가입은 같은 화면). 가입·완료·로그인이 모두 그 한 칸 안에서 이어진다. 실행마다 가입 1회
test("기업 가입 → 기업 탭에서 아이디로 로그인", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const loginId = `biz${stamp}`;
  const password = "Test1234!@";
  // 10자리, 실행마다 다르게 (사업자번호당 계정 1개)
  const bizNo = `9${stamp}0`;
  const m = signup.business.form;
  // 로그인·가입은 주기능 칸(주소창 문서)에 그려진다. 왼쪽 홈은 iframe 1개
  const f = page;

  await test.step("홈 | 로그인 칸의 기업 탭 [회원가입] → 같은 칸이 기업 가입으로", async () => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: home.login, exact: true }).click();
    await f.getByRole("tab", { name: auth.tabs.business }).click();
    await f.getByRole("tabpanel", { name: auth.tabs.business }).getByRole("link", { name: auth.login.signup }).click();
    await expect(f.locator('input[name="contactName"]')).toBeVisible();
    await expect(page.locator('iframe[src="/"]')).toHaveCount(1);
    await expect(page.locator("iframe")).toHaveCount(1);
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
    await f.locator('input[name="startDate"]').fill("2020-01-01");
    await f.getByRole("button", { name: signup.form.contactMethods.email, exact: true }).click();
    await f.locator('input[name="address"]').fill("서울 중구 세종대로 110");
    await expect(submit).toBeDisabled();
    await f.getByRole("checkbox", { name: signup.terms.all }).click();
    await expect(submit).toBeEnabled();
    await submit.click();

    const done = f.getByRole("dialog", { name: signup.result.businessTitle });
    await expect(done).toBeVisible();
    await done.getByRole("button", { name: signup.result.toLogin }).click();
    // 같은 칸이 기업 탭 로그인으로 돌아온다 (칸이 늘거나 닫히지 않는다)
    await expect(f.getByRole("button", { name: auth.login.submit, exact: true })).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(1);
  });

  await test.step("기업 탭에서 아이디로 로그인 → 홈 전체 화면", async () => {
    await f.locator('input[name="loginId"]').fill(loginId);
    await f.locator('input[name="password"]').fill(password);
    await f.getByRole("button", { name: auth.login.submit, exact: true }).click();
    await expect(page.getByRole("button", { name: my.menu.label })).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});
