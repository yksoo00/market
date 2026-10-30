import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { cart } from "@/messages/cart";
import { common } from "@/messages/common";
import { compare } from "@/messages/compare";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { signup } from "@/messages/signup";

// 비교 흐름 (설계 2026-10-27 PR 3, 2026-10-29): 판매자 매물 3개(인텔 CPU 2개 단가 다르게 + AMD CPU 1개)
// → 구매자가 검색 결과에서 셋 다 체크(선택 줄 칩) → 소분류가 섞이면 [비교]가 막힘 → 칩 ✕ 로 AMD 를 빼고 [비교] → 보조 칸 비교 표(최저가·다른 항목만)
// → 비교 화면에서 [빼기] → "2개 이상" 안내. 비교 행은 장바구니 숫자에 안 센다
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

async function register(page: Page, prodName: string, category: string, price: number) {
  await page.goto("/listings/new");
  await page.locator("#productPicker").click();
  await page.getByRole("option", { name: listing.form.master.manualOption }).click();
  await page.locator("#categoryPicker").click();
  await page.getByRole("button", { name: "PC주요부품" }).click();
  await page.getByRole("button", { name: "CPU/프로세서" }).click();
  await page.getByRole("button", { name: category }).click();
  await page.locator('input[name="prodBrand"]').fill("Dell");
  await page.locator('input[name="prodName"]').fill(prodName);
  await page.locator("#prodState").selectOption("신품");
  await page.locator('input[name="salesUnitPrice"]').fill(String(price));
  await page.locator('input[type="file"][accept*=".jpg"]').setInputFiles({
    name: "main.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]),
  });
  await expect(page.getByRole("status", { name: listing.form.uploading })).toBeHidden();
  await page.locator('input[name="salesQuantity"]').fill("5");
  // 제공가능일 필수 (2026-10-27)
  await page.locator('input[name="deliveryDate"]').fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: listing.form.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\/\d{14}$/);
}

test("검색에서 같은 소분류끼리 비교 → 섞이면 막힘 → 비교 화면에서 빼기", async ({ page }) => {
  // 매물 3개 등록 + 가입 2번이라 기본 시간을 넘는다
  test.setTimeout(180_000);
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2eps${stamp}`;
  const buyer = `e2epb${stamp}`;
  const word = `E2E 비교 ${stamp}`;
  const nameA = `${word} A`;
  const nameB = `${word} B`;
  const nameC = `${word} C`;
  page.on("dialog", (d) => void d.accept());
  const cartLink = (n: number) => page.getByRole("link", { name: cart.header.aria(n), exact: true });
  const rowOf = (name: string) => page.getByRole("table").getByRole("row").filter({ hasText: name });
  const check = (name: string) => rowOf(name).getByRole("checkbox", { name: search.result.selectRow(name) }).check();

  await test.step("판매자 가입·등록 3개 (인텔 2개, AMD 1개)", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await register(page, nameA, "인텔 CPU", 10000);
    await register(page, nameB, "인텔 CPU", 9000);
    await register(page, nameC, "AMD CPU", 8000);
    await logOut(page);
  });

  await test.step("구매자: 검색 결과에서 셋 다 체크 → 선택 줄 칩 → 소분류가 섞이면 [비교] 막힘", async () => {
    await signUp(page, buyer, String((Number(stamp) + 1) % 100_000_000).padStart(8, "0"));
    await logIn(page, buyer);
    await page.goto(`/search?q=${encodeURIComponent(word)}`);
    await check(nameA);
    await check(nameB);
    await check(nameC);
    const bar = page.getByRole("region", { name: cart.selection.title(3) });
    await expect(bar).toBeVisible();
    await expect(bar.getByText(nameC)).toBeVisible();
    await page.getByRole("button", { name: compare.button, exact: true }).first().click();
    // 안내는 모달 — 확인으로 닫아야 바깥(선택 줄)을 만질 수 있다
    const notice = page.getByRole("alertdialog").filter({ hasText: compare.otherCategory });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: common.notice.confirm }).click();
    await expect(notice).toBeHidden();
  });

  const frame = page.frameLocator('iframe[src^="/my/cart/compare"]');

  await test.step("인텔 2개 [비교] → 보조 칸 비교 표, 최저가는 B, 다른 항목만 보기", async () => {
    // 선택 줄 칩의 ✕ 로 AMD 를 뺀다
    await page.getByRole("button", { name: cart.selection.removeAria(nameC) }).click();
    await expect(page.getByRole("region", { name: cart.selection.title(2) })).toBeVisible();
    await page.getByRole("button", { name: compare.button, exact: true }).first().click();
    await expect(frame.getByText(compare.page.count(2))).toBeVisible();
    const priceRow = frame.getByRole("row").filter({ has: frame.getByRole("rowheader", { name: listing.detail.rows.unitPrice, exact: true }) });
    // 열 순서는 담은 순서라 값으로 찾는다
    await expect(priceRow.getByRole("cell").filter({ hasText: "9,000" })).toContainText(compare.best.unitPrice);
    await expect(priceRow.getByRole("cell").filter({ hasText: "10,000" })).not.toContainText(compare.best.unitPrice);
    const brandHeader = frame.getByRole("rowheader", { name: listing.detail.rows.brand, exact: true });
    await expect(brandHeader).toBeVisible();
    await frame.getByRole("checkbox", { name: compare.page.onlyDiff }).check();
    // 제조사는 둘 다 Dell 이라 숨고, 단가는 달라 남는다
    await expect(brandHeader).toHaveCount(0);
    await expect(priceRow).toHaveCount(1);
  });

  await test.step("비교 화면에서 B [빼기] → 2개 이상 안내, 장바구니 숫자는 그대로 0", async () => {
    await frame.getByRole("button", { name: compare.page.removeAria(nameB) }).click();
    await expect(frame.getByText(compare.page.tooFew)).toBeVisible();
    // 비교 행은 장바구니 숫자에 안 센다
    await expect(cartLink(0)).toBeVisible();
  });
});
