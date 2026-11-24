import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { signup } from "@/messages/signup";
import { xlsx } from "./support/xlsx";

// 엑셀 판매상품 다량 등록 (계획 2026-11-05-bulk-listing-excel.md): 상품 하나를 직접 등록해 마스터를 만들고 → 홈 아이콘으로 모달을 열어
// 엑셀 3줄(마스터 찾음 · 수량 0 오류 · 새 마스터)을 올린다 → 오류 줄을 고치고 새 마스터 줄을 체크 → [선택 확정] → 3건 등록됨
const password = "Test1234!@";
const b = listing.bulk;
const p = listing.bulk.page;

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

/** 마스터를 만들려고 상품 하나를 직접 입력으로 등록 (대표 사진 있음) */
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
  await page.locator('input[name="deliveryDate"]').fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: listing.form.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/listings\/UP\d{9}\/\d{14}$/);
}

/** 새 양식(백엔드 ListingBulkParser.TEMPLATE_LABELS 중 첨부 칸 제외) — 상품ID·분류번호·카테고리 코드 칸이 없다 */
const HEADERS = ["상품명*", "제조사*", "상품번호", "상품상태*", "단가*", "수량*", "제공가능일*", "최소주문수량", "주문단위", "설명"];

function line(name: string, quantity: string): (string | null)[] {
  const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return [name, "Dell", null, "신품", "20000", quantity, date, null, null, null];
}

test("새 양식: 사용자가 모르는 칸 없이 올리고 → 새 상품은 화면에서 카테고리를 골라 → 확정", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2etp${stamp}`;
  const known = `E2E양식 ${stamp}`;
  const fresh = `E2E새양식 ${stamp}`;
  page.on("dialog", (d) => void d.accept());

  await test.step("가입·로그인·마스터가 될 상품 하나 등록", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await register(page, known);
  });

  const card = (n: number) => page.getByRole("listitem").filter({ has: page.getByText(b.line.row(n), { exact: true }) });
  const tab = (name: string, count: number) => page.getByRole("tab", { name: `${name} ${count}` });

  await test.step("분류번호·카테고리 코드 없이 이름·제조사만으로 올린다: 마스터는 찾고, 새 상품은 카테고리를 고르라고 한다", async () => {
    await page.goto("/listings/bulk");
    const file = xlsx([HEADERS, line(known.toUpperCase(), "3"), line(fresh, "2")]);
    await page.locator('input[type="file"][accept=".xlsx"]').setInputFiles({
      name: "bulk.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: file,
    });
    await expect(tab(p.tabs.all, 2)).toBeVisible();
    await expect(tab(p.tabs.ok, 1)).toBeVisible();
    await expect(tab(p.tabs.failed, 1)).toBeVisible();
    await expect(card(2).getByRole("checkbox")).toBeChecked();
    await expect(card(3).getByRole("checkbox")).toBeDisabled();
    await expect(card(3).getByText(/카테고리를 골라/)).toBeVisible();
  });

  await test.step("[카테고리 고르기]에서 소분류를 고르면 새 상품이 되어 체크할 수 있다", async () => {
    // 버튼의 접근 가능한 이름은 칸 라벨("카테고리")과 오류 문구가 되므로 버튼 글자로 찾는다
    await card(3).getByText(p.categoryEmpty, { exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "PC주요부품" }).click();
    await dialog.getByRole("button", { name: "CPU/프로세서" }).click();
    await dialog.getByRole("button", { name: "인텔 CPU" }).click();
    await expect(dialog).toBeHidden();
    await expect(tab(p.tabs.new, 1)).toBeVisible();
    await expect(card(3).getByRole("checkbox")).toBeEnabled();
    await card(3).getByRole("checkbox").check();
  });

  await test.step("선택 확정 → 2건 등록됨", async () => {
    await page.getByRole("button", { name: b.actions.commitSelected(2) }).click();
    await expect(page.getByText(b.done(2))).toBeVisible();
    await expect(page.getByText(b.allDone)).toBeVisible();
  });
});
