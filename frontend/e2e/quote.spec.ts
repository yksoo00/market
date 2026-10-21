import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { signup } from "@/messages/signup";
import { trade } from "@/messages/trade";

// 견적 흐름: 판매자 등록(단가 10000) → 구매자 검색 결과에서 [견적 요청](희망단가 9000) → 판매자 받은 구매요청에서 [수락]
// → 매물 단가가 9000 으로 바뀜 → 구매자 내 구매목록의 [구매]. 가입이 2번(판매자·구매자)
const password = "Test1234!@";
const t = trade.list;
const q = trade.quote;

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

test("견적 요청 → 판매자 수락(매물 단가 변경) → 구매자 [구매]", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2eqs${stamp}`;
  const buyer = `e2eqb${stamp}`;
  const prodName = `E2E 견적 ${stamp}`;
  let listingPath = "";
  page.on("dialog", (d) => void d.accept());

  await test.step("판매자 가입·로그인·등록 (단가 10000, 재고 5)", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await page.goto("/listings/new");
    await page.locator("#productPicker").click();
    await page.getByRole("option", { name: listing.form.master.manualOption }).click();
    await page.locator("#categoryPicker").click();
    await page.getByRole("button", { name: "PC주요부품" }).click();
    await page.getByRole("button", { name: "CPU/프로세서" }).click();
    await page.getByRole("button", { name: "인텔 CPU" }).click();
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
    await logOut(page);
  });

  await test.step("구매자: 검색 결과에서 체크 → [견적 요청] → 희망단가 9000", async () => {
    await signUp(page, buyer, String((Number(stamp) + 1) % 100_000_000).padStart(8, "0"));
    await logIn(page, buyer);
    await page.goto(`/search?q=${encodeURIComponent(prodName)}`);
    const row = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    await row.getByRole("checkbox", { name: search.result.selectRow(prodName) }).check();
    await page.getByRole("button", { name: search.result.quote, exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: q.title });
    await expect(dialog.getByText(prodName)).toBeVisible();
    const price = dialog.locator('input[name="items.0.orderUnitPrice"]');
    const submit = dialog.getByRole("button", { name: q.submit(1) });
    // 등록단가보다 비싸면 막힌다
    await price.fill("10001");
    await price.blur();
    await expect(dialog.getByText(q.validation.priceRange(10000))).toBeVisible();
    await expect(submit).toBeDisabled();
    await price.fill("9000");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole("dialog", { name: q.doneTitle })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await test.step("구매자 내 구매목록: 견적요청 줄 (등록단가 → 희망단가), [취소] 만", async () => {
    await page.goto("/my/purchases");
    const row = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    await expect(row.getByText(t.stats.quoteRequested)).toBeVisible();
    await expect(row).toContainText("9,000");
    await expect(page.getByRole("button", { name: t.cancelAria(prodName) })).toBeVisible();
    await expect(page.getByRole("button", { name: t.buyAria(prodName) })).toHaveCount(0);
    await logOut(page);
  });

  await test.step("판매자 받은 구매요청: [수락] → 매물 단가 9000", async () => {
    await logIn(page, seller);
    await page.goto("/my/sales");
    await page.getByRole("button", { name: t.acceptAria(prodName) }).click();
    const row = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    await expect(row.getByText(t.stats.quoteReplied)).toBeVisible();
    // 답한 뒤엔 수락·거절 버튼이 없다 (두 번 누를 수 없음)
    await expect(page.getByRole("button", { name: t.acceptAria(prodName) })).toHaveCount(0);
    await page.goto(listingPath);
    await expect(page.getByText("9,000").first()).toBeVisible();
    await logOut(page);
  });

  await test.step("구매자: 회신 완료 줄의 [구매] → 구매 모달 → 구매요청", async () => {
    await logIn(page, buyer);
    await page.goto("/my/purchases");
    await page.getByRole("button", { name: t.buyAria(prodName) }).click();
    const dialog = page.getByRole("dialog", { name: trade.purchase.title });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="orderQuantity"]').fill("1");
    await dialog.locator('input[name="reqDeliDate"]').fill(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + 7 * 86_400_000)),
    );
    await dialog.getByRole("button", { name: trade.purchase.submit, exact: true }).click();
    await expect(page.getByRole("dialog", { name: trade.purchase.doneTitle })).toBeVisible();
    await page.keyboard.press("Escape");
    // 새 구매요청 줄이 생기고 단가는 바뀐 9000
    const bought = page.getByRole("table").getByRole("row").filter({ hasText: prodName }).filter({ hasText: t.stats.requested });
    await expect(bought).toHaveCount(1);
    await expect(bought).toContainText("9,000");
  });
});
