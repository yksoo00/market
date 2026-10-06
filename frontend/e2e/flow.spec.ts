import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { signup } from "@/messages/signup";

// 칸 옆 [중복확인] — 순서(first/nth)가 아니라 그 칸이 든 줄에서 찾는다 (칸 순서·별명 사용 여부가 바뀌어도 맞는 버튼)
const checkButton = (page: Page, name: string) =>
  page.locator(`input[name="${name}"]`).locator("xpath=ancestor::div[.//button][1]").getByRole("button", { name: signup.form.check });

// 가입 → 로그인 → 매물 등록 → 상세 → 마이페이지 → 내 판매글(행 안 수정). 실행마다 새 계정이라 로컬 DB 에 사용자·매물이 하나씩 남는다 (서로 안 겹침)
// 가입은 IP 당 시간당 5회 — 한 시간에 6번 이상 돌리면 가입 단계가 429 로 실패한다
// 방금 등록한 글의 표 행 (다른 글이 함께 보여도 이 행만 본다)
const rowOf = (page: Page, name: string) => page.getByRole("table").getByRole("row").filter({ hasText: name });

test("가입 → 로그인 → 매물 등록 → 상세 → 마이페이지 → 내 판매글 행 수정", async ({ page }) => {
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
    await checkButton(page, "nickname").click();
    await expect(page.getByText(signup.form.available.nickname)).toBeVisible();
    await page.locator('input[name="loginId"]').fill(loginId);
    await checkButton(page, "loginId").click();
    await expect(page.getByText(signup.form.available.loginId)).toBeVisible();
    await page.locator('input[name="emailLocal"]').fill(loginId);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="passwordConfirm"]').fill(password);
    await page.locator('input[name="phoneMid"]').fill(stamp.slice(0, 4));
    await page.locator('input[name="phoneLast"]').fill(stamp.slice(4, 8));
    const submit = page.getByRole("button", { name: signup.form.submit });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/signup\/done$/);
  });

  await test.step("로그인", async () => {
    await page.goto("/login");
    await page.locator('input[name="loginId"]').fill(loginId);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: auth.login.submit, exact: true }).click();
    await expect(page.getByRole("button", { name: my.menu.label })).toBeVisible();
  });

  await test.step("매물 등록 — 마지막 칸 입력 직후 [등록]이 켜진다", async () => {
    await page.goto("/listings/new");
    await page.locator('input[name="categoryCode"]').fill("서버");
    await page.locator('input[name="prodBrand"]').fill("Dell");
    await page.locator('input[name="prodName"]').fill(prodName);
    await page.locator("#prodState").selectOption("신품");
    await page.locator('input[name="salesUnitPrice"]').fill("1500000");
    const submit = page.getByRole("button", { name: listing.form.submit, exact: true });
    await expect(submit).toBeDisabled();
    // 마지막 필수 칸: blur 없이 입력만 한 상태에서 버튼이 켜져야 한다 (onBlur 모드 때 첫 클릭이 꺼진 버튼에 먹히던 문제)
    await page.locator('input[name="salesQuantity"]').fill("3");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\/\d{14}$/);
    await expect(page.getByText(prodName).first()).toBeVisible();
  });

  await test.step("마이페이지 허브", async () => {
    await page.getByRole("button", { name: my.menu.label }).click();
    await page.getByRole("menuitem", { name: my.menu.myPage }).click();
    await expect(page).toHaveURL(/\/my$/);
    // 메뉴는 이동 뒤 닫혀야 한다 (타일 엔진의 링크 가로채기와 Radix 닫기가 부딪히던 문제)
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(page.getByText(nickname).first()).toBeVisible();
  });

  await test.step("내 판매글 — 검색 화면 모양으로 방금 글이 보이고, 행 안에서 상품상태를 고친다", async () => {
    await page.getByRole("button", { name: my.menu.label }).click();
    await page.getByRole("menuitem", { name: my.menu.myListings }).click();
    await expect(page).toHaveURL(/\/my\/listings$/);
    await expect(page.getByRole("menu")).toBeHidden();
    // 표와 모바일 카드가 둘 다 그려지므로(하나는 CSS 로 숨김) 표 안에서 찾는다
    await expect(rowOf(page, prodName)).toBeVisible();

    // 표 행 끝 [수정] → 그 행의 입력칸 (거래상태 기본값이 전체라 방금 글이 보인다)
    await page.getByRole("button", { name: my.mine.editAria(prodName) }).click();
    await expect(page.getByLabel(search.columns.prodName)).toHaveValue(prodName);
    const save = page.getByRole("button", { name: my.mine.row.save, exact: true });
    await expect(save).toBeDisabled();
    await page.getByLabel(search.columns.state).selectOption("신품대비 80~89%");
    // 상품설명 칸은 행 아래 폼 — 누르면 그 항목만 고치는 칸이 뜬다
    await page.getByRole("button", { name: `${search.columns.prodDescription} ${my.mine.row.panelNone}` }).click();
    await page.getByLabel(listing.form.description, { exact: false }).fill("E2E 설명");
    await expect(save).toBeEnabled();
    await save.click();

    // 저장하면 목록으로 돌아오고 그 행이 바뀐 값으로 보인다
    await expect(rowOf(page, prodName).getByText("신품대비 80~89%")).toBeVisible();
    await expect(rowOf(page, prodName)).toBeVisible();

    // 다시 열면 방금 저장한 설명이 채워져 있다 (열 때 상세를 다시 받는다)
    await page.getByRole("button", { name: my.mine.editAria(prodName) }).click();
    await expect(page.getByRole("button", { name: `${search.columns.prodDescription} ${my.mine.row.panelHas}` })).toBeVisible();
    await page.getByRole("button", { name: my.mine.row.cancel, exact: true }).click();
    await expect(rowOf(page, prodName)).toBeVisible();
  });

  await test.step("내 글만 보인다 — 헤더 줄 + 방금 등록한 글 한 줄 (다른 사용자 글은 없다)", async () => {
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  });
});
