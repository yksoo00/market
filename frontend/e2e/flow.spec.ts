import { expect, test } from "@playwright/test";

// 가입 → 로그인 → 매물 등록 → 상세 → 마이페이지. 실행마다 새 계정이라 로컬 DB 에 사용자·매물이 하나씩 남는다 (서로 안 겹침)
// 가입은 IP 당 시간당 5회 — 한 시간에 6번 이상 돌리면 가입 단계가 429 로 실패한다
test("가입 → 로그인 → 매물 등록 → 상세 → 마이페이지", async ({ page }) => {
  // 아이디(영문 소문자·숫자 5~20)·닉네임(2~20)·휴대폰 뒤 8자리를 실행마다 다르게
  const stamp = Date.now().toString().slice(-8);
  const loginId = `e2e${stamp}`;
  const nickname = `테스트${stamp.slice(-6)}`;
  const password = "Test1234!@";
  const prodName = `E2E 서버 ${stamp}`;

  await test.step("개인 가입", async () => {
    await page.goto("/signup/personal/form");
    await page.locator('input[name="name"]').fill("홍길동");
    await page.locator('input[name="nickname"]').fill(nickname);
    await page.getByRole("button", { name: "중복확인" }).first().click();
    await expect(page.getByText("사용할 수 있는 닉네임입니다.")).toBeVisible();
    await page.locator('input[name="loginId"]').fill(loginId);
    await page.getByRole("button", { name: "중복확인" }).nth(1).click();
    await expect(page.getByText("사용할 수 있는 아이디입니다.")).toBeVisible();
    await page.locator('input[name="emailLocal"]').fill(loginId);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="passwordConfirm"]').fill(password);
    await page.locator('input[name="phoneMid"]').fill(stamp.slice(0, 4));
    await page.locator('input[name="phoneLast"]').fill(stamp.slice(4, 8));
    const submit = page.getByRole("button", { name: "가입하기" });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/signup\/done$/);
  });

  await test.step("로그인", async () => {
    await page.goto("/login");
    await page.locator('input[name="loginId"]').fill(loginId);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByRole("button", { name: "내 메뉴" })).toBeVisible();
  });

  await test.step("매물 등록 — 마지막 칸 입력 직후 [등록]이 켜진다", async () => {
    await page.goto("/listings/new");
    await page.locator('input[name="categoryCode"]').fill("서버");
    await page.locator('input[name="prodBrand"]').fill("Dell");
    await page.locator('input[name="prodName"]').fill(prodName);
    await page.locator("#prodState").selectOption("신품");
    await page.locator('input[name="salesUnitPrice"]').fill("1500000");
    const submit = page.getByRole("button", { name: "등록", exact: true });
    await expect(submit).toBeDisabled();
    // 마지막 필수 칸: blur 없이 입력만 한 상태에서 버튼이 켜져야 한다 (onBlur 모드 때 첫 클릭이 꺼진 버튼에 먹히던 문제)
    await page.locator('input[name="salesQuantity"]').fill("3");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\/\d{14}$/);
    await expect(page.getByText(prodName).first()).toBeVisible();
  });

  await test.step("마이페이지에 방금 등록한 글", async () => {
    await page.getByRole("button", { name: "내 메뉴" }).click();
    await page.getByRole("menuitem", { name: "마이페이지" }).click();
    await expect(page).toHaveURL(/\/my$/);
    // 메뉴는 이동 뒤 닫혀야 한다 (타일 엔진의 링크 가로채기와 Radix 닫기가 부딪히던 문제)
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(page.getByText(prodName)).toBeVisible();
    await expect(page.getByText(nickname).first()).toBeVisible();
  });
});
