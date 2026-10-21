import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { cart } from "@/messages/cart";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { signup } from "@/messages/signup";
import { trade } from "@/messages/trade";

// 장바구니 흐름 (스펙 2026-10-21): 판매자 매물 2개 → 구매자 검색 결과에서 둘 다 [장바구니] → 헤더 숫자 2
// → 장바구니에서 하나 [구매] → 그 줄은 빠지고 내 구매목록에 구매요청, 헤더 1 → 남은 하나 [빼기] → 빈 장바구니, 배지 없음
const password = "Test1234!@";

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

async function register(page: Page, prodName: string) {
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
}

test("검색에서 장바구니 담기 → 헤더 숫자 → 장바구니에서 구매 → 빼기", async ({ page }) => {
  // 매물 2개 등록 + 가입 2번이라 기본 60초를 넘는다
  test.setTimeout(150_000);
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2ecs${stamp}`;
  const buyer = `e2ecb${stamp}`;
  const word = `E2E 장바구니 ${stamp}`;
  const nameA = `${word} A`;
  const nameB = `${word} B`;
  page.on("dialog", (d) => void d.accept());
  const cartLink = (n: number) => page.getByRole("link", { name: cart.header.aria(n), exact: true });
  const rowOf = (name: string) => page.getByRole("table").getByRole("row").filter({ hasText: name });

  await test.step("판매자 가입·등록 2개", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await register(page, nameA);
    await register(page, nameB);
    await logOut(page);
  });

  await test.step("구매자: 검색 결과에서 둘 다 체크 → [장바구니] → 헤더 숫자 2", async () => {
    await signUp(page, buyer, String((Number(stamp) + 1) % 100_000_000).padStart(8, "0"));
    await logIn(page, buyer);
    await expect(cartLink(0)).toBeVisible();
    await page.goto(`/search?q=${encodeURIComponent(word)}`);
    await rowOf(nameA).getByRole("checkbox", { name: search.result.selectRow(nameA) }).check();
    await rowOf(nameB).getByRole("checkbox", { name: search.result.selectRow(nameB) }).check();
    await page.getByRole("button", { name: cart.add.button, exact: true }).first().click();
    const done = page.getByRole("dialog", { name: cart.add.doneTitle });
    await expect(done).toBeVisible();
    // 모달이 열린 동안엔 바깥이 aria-hidden — 닫고 헤더를 본다
    await page.keyboard.press("Escape");
    await expect(cartLink(2)).toBeVisible();
    // 장바구니는 내 구매목록에 섞이지 않는다
    await page.goto("/my/purchases");
    await expect(page.getByText(nameA)).toHaveCount(0);
  });

  await test.step("장바구니에서 A [구매] → A 는 빠지고 내 구매목록에 구매요청, 헤더 1", async () => {
    await page.goto("/my/cart");
    await expect(rowOf(nameA)).toHaveCount(1);
    await expect(rowOf(nameB)).toHaveCount(1);
    await rowOf(nameA).getByRole("checkbox", { name: search.result.selectRow(nameA) }).check();
    await page.getByRole("button", { name: search.result.buy, exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: trade.purchase.title });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="orderQuantity"]').fill("1");
    await dialog.locator('input[name="reqDeliDate"]').fill(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + 7 * 86_400_000)),
    );
    await dialog.getByRole("button", { name: trade.purchase.submit, exact: true }).click();
    await expect(page.getByRole("dialog", { name: trade.purchase.doneTitle })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cartLink(1)).toBeVisible();
    await expect(rowOf(nameA)).toHaveCount(0);
    await expect(rowOf(nameB)).toHaveCount(1);
    await page.goto("/my/purchases");
    await expect(rowOf(nameA).getByText(trade.list.stats.requested)).toBeVisible();
  });

  await test.step("남은 B [빼기] → 빈 장바구니, 배지 없음", async () => {
    await page.goto("/my/cart");
    await rowOf(nameB).getByRole("checkbox", { name: search.result.selectRow(nameB) }).check();
    await page.getByRole("button", { name: cart.page.remove, exact: true }).first().click();
    await expect(page.getByText(cart.page.empty)).toBeVisible();
    await expect(cartLink(0)).toBeVisible();
  });
});
