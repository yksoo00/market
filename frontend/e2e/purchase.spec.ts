import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { signup } from "@/messages/signup";
import { trade } from "@/messages/trade";

// 구매 흐름: 판매자 등록 → 구매자 [구매] 모달로 요청 → 내 구매목록 [거래완료] → 다시 요청 → 판매자가 받은 구매요청에서 [취소].
// 가입이 2번(판매자·구매자) — IP 당 시간당 5회 한도라 flow.spec 과 같이 돌리면 한 시간에 두 번까지만
const password = "Test1234!@";
const t = trade.list;

const checkButton = (page: Page, name: string) =>
  page.locator(`input[name="${name}"]`).locator("xpath=ancestor::div[.//button][1]").getByRole("button", { name: signup.form.check });

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

async function logOut(page: Page) {
  await page.getByRole("button", { name: my.menu.label }).click();
  await page.getByRole("menuitem", { name: my.menu.logout }).click();
  await expect(page.getByRole("button", { name: my.menu.label })).toBeHidden();
}

/** 한국 날짜 기준 n일 뒤 YYYY-MM-DD */
const daysLater = (n: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + n * 86_400_000));

async function requestPurchase(page: Page, listingPath: string, quantity: string) {
  await page.goto(listingPath);
  await page.getByRole("button", { name: listing.detail.buy, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: trade.purchase.title });
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole("button", { name: trade.purchase.submit, exact: true });
  await dialog.locator('input[name="orderQuantity"]').fill(quantity);
  // 매물 납기일이 없으면 납품희망일 필수 — 비어 있으면 버튼이 꺼져 있다
  await expect(submit).toBeDisabled();
  await dialog.locator('input[name="reqDeliDate"]').fill(daysLater(7));
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("dialog", { name: trade.purchase.doneTitle })).toBeVisible();
  await page.keyboard.press("Escape");
}

test("구매요청 → 구매자 거래완료, 다시 요청 → 판매자 취소", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2es${stamp}`;
  const buyer = `e2eb${stamp}`;
  const prodName = `E2E 구매 ${stamp}`;
  let listingPath = "";
  page.on("dialog", (d) => void d.accept());

  await test.step("판매자 가입·로그인·등록 (재고 5)", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await page.goto("/listings/new");
    await page.locator("#productPicker").click();
    await page.getByRole("option", { name: listing.form.master.manualOption }).click();
    await page.locator("#categoryPicker").fill("인텔");
    await page.getByRole("option", { name: /인텔 CPU/ }).click();
    await page.locator('input[name="prodBrand"]').fill("Dell");
    await page.locator('input[name="prodName"]').fill(prodName);
    await page.locator("#prodState").selectOption("신품");
    await page.locator('input[name="salesUnitPrice"]').fill("10000");
    await page.locator('input[type="file"][accept*=".jpg"]').setInputFiles({
      name: "main.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]),
    });
    await expect(page.getByRole("status", { name: listing.form.uploading })).toBeHidden();
    await page.locator('input[name="salesQuantity"]').fill("5");
    await page.getByRole("button", { name: listing.form.submit, exact: true }).click();
    await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\/\d{14}$/);
    listingPath = new URL(page.url()).pathname;
    // 내 매물이라 [구매]가 없다
    await expect(page.getByRole("button", { name: listing.detail.buy, exact: true })).toHaveCount(0);
    // 검색 결과에서는 체크하고 [구매]를 누를 수 있지만, 모달이 내 매물이라고 막는다 (폼을 채운 뒤 403 이 아니라)
    await page.goto(`/search?q=${encodeURIComponent(prodName)}`);
    await page.getByRole("checkbox", { name: search.result.selectRow(prodName) }).first().check();
    await page.getByRole("button", { name: search.result.buy, exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: trade.purchase.title });
    await expect(dialog.getByText(trade.purchase.blocked.own)).toBeVisible();
    await expect(dialog.locator('input[name="orderQuantity"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await logOut(page);
  });

  await test.step("구매자 가입·로그인 → [구매] 모달로 2개 요청", async () => {
    // 휴대폰 번호가 판매자와 겹치지 않게 뒤 8자리를 바꾼다
    await signUp(page, buyer, String((Number(stamp) + 1) % 100_000_000).padStart(8, "0"));
    await logIn(page, buyer);
    await requestPurchase(page, listingPath, "2");
  });

  await test.step("내 구매목록 — 구매요청 → [거래완료] → 구매확정", async () => {
    await page.goto("/my/purchases");
    const row = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    await expect(row.getByText(t.stats.requested)).toBeVisible();
    await page.getByRole("button", { name: t.completeAria(prodName) }).click();
    await expect(row.getByText(t.stats.confirmed)).toBeVisible();
    await expect(page.getByRole("button", { name: t.completeAria(prodName) })).toHaveCount(0);
  });

  await test.step("다시 1개 요청 → 판매자 내 판매글에 1건 → 받은 구매요청에서 [취소]", async () => {
    await requestPurchase(page, listingPath, "1");
    await logOut(page);
    await logIn(page, seller);
    await page.goto("/my/listings");
    const listingRow = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    // 건수를 누르면 받은 구매요청이 그 매물로 걸러져 옆 칸(반반)에 열린다 — 같은 판매 그룹
    await listingRow.getByRole("button", { name: trade.pending.aria(prodName, 1) }).click();
    await expect(page.locator('iframe[src^="/my/sales?reg="]')).toBeVisible();
    await expect(page.frameLocator('iframe[src^="/my/sales?reg="]').getByText(my.sales.filtered)).toBeVisible();

    await page.goto("/my/sales");
    const pendingRow = page.getByRole("table").getByRole("row").filter({ hasText: t.stats.requested });
    await expect(pendingRow).toHaveCount(1);
    // 판매자는 [거래완료]가 없고 [취소]만
    await expect(page.getByRole("button", { name: t.completeAria(prodName) })).toHaveCount(0);
    await page.getByRole("button", { name: t.cancelAria(prodName) }).click();
    await expect(page.getByRole("table").getByText(t.stats.canceled)).toBeVisible();
    await expect(page.getByRole("table").getByText(t.stats.confirmed)).toBeVisible();
  });
});
