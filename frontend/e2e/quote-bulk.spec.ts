import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { signup } from "@/messages/signup";
import { trade } from "@/messages/trade";

// 받은 견적요청 한꺼번에 처리 (계획 2026-11-03-quote-bulk-reply.md): 판매자 상품 2개(A 재고 10, B 재고 5) → 구매자 둘이 견적
// (A 는 6+6 으로 재고 초과, B 는 2) → 판매자 요청 탭 [모든 견적요청 보기] → [모두 수락] → A 묶음은 사유와 함께 실패, B 는 수락됨
// → A 를 건별로: 첫 건 수락, 둘째 건은 재고 부족
const password = "Test1234!@";
const b = trade.bulk;

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

async function register(page: Page, prodName: string, quantity: number) {
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
  await page.locator('input[name="salesQuantity"]').fill(String(quantity));
  await page.locator('input[name="deliveryDate"]').fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: listing.form.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\/\d{14}$/);
}

/** 검색 결과에서 상품을 체크해 한 번에 견적 요청 — 줄마다 수량 (희망단가 9000) */
async function requestQuotes(page: Page, word: string, lines: { name: string; quantity: number }[]) {
  await page.goto(`/search?q=${encodeURIComponent(word)}`);
  for (const { name } of lines) {
    await page.getByRole("table").getByRole("row").filter({ hasText: name }).getByRole("checkbox", { name: search.result.selectRow(name) }).check();
  }
  await page.getByRole("button", { name: search.result.quote, exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: trade.quote.title });
  for (const { name, quantity } of lines) {
    const item = dialog.locator("li").filter({ hasText: name });
    await item.locator('input[name$="orderUnitPrice"]').fill("9000");
    await item.locator('input[name$="orderQuantity"]').fill(String(quantity));
  }
  await dialog.getByRole("button", { name: trade.quote.submit(lines.length) }).click();
  await expect(page.getByRole("dialog", { name: trade.quote.doneTitle })).toBeVisible();
  await page.keyboard.press("Escape");
}

test("받은 견적요청 한꺼번에: 모두 수락 → 재고 초과 묶음은 사유와 함께 실패·나머지는 수락됨 → 건별 수락", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2ebs${stamp}`;
  const buyer1 = `e2ebb${stamp}`;
  const buyer2 = `e2ebc${stamp}`;
  const word = `E2E일괄 ${stamp}`;
  const nameA = `${word} A`;
  const nameB = `${word} B`;
  page.on("dialog", (d) => void d.accept());

  await test.step("판매자 가입·로그인·상품 A(재고 10)·B(재고 5) 등록", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await register(page, nameA, 10);
    await register(page, nameB, 5);
    await logOut(page);
  });

  await test.step("구매자 둘이 견적: 구매자1 = A 6 + B 2, 구매자2 = A 6", async () => {
    await signUp(page, buyer1, String((Number(stamp) + 1) % 100_000_000).padStart(8, "0"));
    await logIn(page, buyer1);
    await requestQuotes(page, word, [
      { name: nameA, quantity: 6 },
      { name: nameB, quantity: 2 },
    ]);
    await logOut(page);
    await signUp(page, buyer2, String((Number(stamp) + 2) % 100_000_000).padStart(8, "0"));
    await logIn(page, buyer2);
    await requestQuotes(page, word, [{ name: nameA, quantity: 6 }]);
    await logOut(page);
  });

  // 묶음 = 모달 안의 매물 한 덩어리(상품명이 머리에 있는 li)
  const group = (name: string) => page.getByRole("dialog", { name: b.title }).locator("li").filter({ hasText: name, has: page.getByText(/요청 합계/) });

  await test.step("판매자: [모든 견적요청 보기] — 같은 상품끼리 묶이고 A 는 합계가 재고를 넘는다고 표시", async () => {
    await logIn(page, seller);
    await page.goto("/my/activity?tab=requests");
    await page.getByRole("button", { name: b.open }).click();
    const dialog = page.getByRole("dialog", { name: b.title });
    await expect(dialog.getByRole("button", { name: b.acceptAll(3) })).toBeVisible();
    await expect(group(nameA)).toContainText(b.stock(10));
    await expect(group(nameA)).toContainText(b.sum(12));
    await expect(group(nameA)).toContainText(b.overStock);
    await expect(group(nameB)).toContainText(b.sum(2));
  });

  await test.step("[모두 수락] → B 는 수락됨, A 묶음은 통째로 실패(합계 12 > 재고 10)", async () => {
    const dialog = page.getByRole("dialog", { name: b.title });
    await dialog.getByRole("button", { name: b.acceptAll(3) }).click();
    await expect(group(nameB).getByText(b.accepted)).toBeVisible();
    await expect(group(nameA).getByText(/견적 합계 12개가 재고 10개를 넘어요/)).toHaveCount(2);
    await expect(group(nameA).getByText(b.accepted)).toHaveCount(0);
    // 성공한 건은 처리됐고 실패한 건만 남은 수락 대상이다
    await expect(dialog.getByRole("button", { name: b.acceptAll(2) })).toBeVisible();
  });

  await test.step("건별로: A 의 첫 건 [수락] 되고 둘째 건은 재고 부족 사유가 그 줄에 뜬다", async () => {
    const dialog = page.getByRole("dialog", { name: b.title });
    await group(nameA).getByRole("button", { name: new RegExp(`${nameA}.*견적 수락`) }).first().click();
    await expect(group(nameA).getByText(b.accepted)).toHaveCount(1);
    await group(nameA).getByRole("button", { name: new RegExp(`${nameA}.*견적 수락`) }).first().click();
    await expect(group(nameA).getByRole("alert").filter({ hasText: /재고/ }).first()).toBeVisible();
    // 둘째 건은 [거절]로 마무리 → 모두 처리
    await group(nameA).getByRole("button", { name: new RegExp(`${nameA}.*견적 거절`) }).first().click();
    await expect(group(nameA).getByText(b.rejected)).toHaveCount(1);
    await dialog.getByRole("button", { name: b.close, exact: true }).click();
    await expect(dialog).toBeHidden();
  });
});
