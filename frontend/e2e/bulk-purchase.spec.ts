import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { buyBulk } from "@/messages/buyBulk";
import { home } from "@/messages/home";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { signup } from "@/messages/signup";
import { xlsx } from "./support/xlsx";

// 엑셀 대량구매 (계획 2026-11-09-bulk-purchase-excel.md): 판매자가 상품 둘을 등록 → 구매자가 /buy/bulk 에 엑셀 3줄(매물 있음 · 수량 0 오류 · 마스터에 없는 상품)을 올린다
// → 확인 필요 탭에서 수량 0 줄을 고치고(고치는 중에 줄이 탭에서 안 빠진다) → 선택해서 담기 → 담김 탭 → 새로고침해도 이어짐(선택은 풀리고 다시 맞춰 봄) → 장바구니에 줄이 있다
const password = "Test1234!@";
const t = buyBulk;

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

/** 판매자가 상품 하나를 직접 입력으로 등록 (대표 사진 있음, 재고 5) */
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
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\/\d{14}$/);
}

/** 양식 헤더(* 는 필수 표시) — 백엔드 CartBulkParser.HEADER_LABELS 와 같은 순서 */
const HEADERS = ["상품명*", "제조사*", "분류번호", "상품ID", "수량*", "납품희망일*", "요청사항"];

function line(name: string, quantity: string): (string | null)[] {
  const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return [name, "Dell", null, null, quantity, date, null];
}

test("엑셀 대량구매: 올리고 → 확인 필요 탭에서 고치고 → 선택해서 담기 → 담김 탭·새로고침 복원 → 장바구니에 줄", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2ebp${stamp}`;
  const buyer = `e2ebq${stamp}`;
  const nameA = `E2E구매A ${stamp}`;
  const nameB = `E2E구매B ${stamp}`;
  page.on("dialog", (d) => void d.accept());

  await test.step("판매자 가입·로그인·상품 둘 등록 후 로그아웃", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await register(page, nameA);
    await register(page, nameB);
    await logOut(page);
  });

  await test.step("구매자 가입·로그인", async () => {
    await signUp(page, buyer, String((Number(stamp) + 1) % 100_000_000).padStart(8, "0"));
    await logIn(page, buyer);
  });

  const card = (n: number) => page.getByRole("listitem").filter({ has: page.getByText(t.line.row(n), { exact: true }) });
  const tab = (name: string, count: number) => page.getByRole("tab", { name: `${name} ${count}` });
  // 칸의 이름이 오류 문구까지 포함해 읽히므로(label 이 입력 칸과 오류 문구를 함께 감싼다) 이름이 "수량"으로 시작하는 칸을 찾는다
  const qty = (n: number) =>
    card(n)
      .locator("label")
      .filter({ hasText: new RegExp(`^${t.fields.orderQuantity}`) })
      .locator("input");

  await test.step("홈 아이콘이 대량구매 페이지로 가는 링크이고, 페이지에서 엑셀 3줄을 올린다", async () => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: home.quick.buyBulk })).toHaveAttribute("href", "/buy/bulk");
    await page.goto("/buy/bulk");
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
    const file = xlsx([HEADERS, line(nameA, "3"), line(nameB, "0"), line(`E2E구매없음 ${stamp}`, "1")]);
    await page.locator('input[type="file"][accept=".xlsx"]').setInputFiles({
      name: "buy.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: file,
    });
    // 2행: 매물 있음(체크됨), 3행: 수량 0 이라 확인 필요, 4행: 마스터에 없어 확인 필요
    await expect(tab(t.tabs.all, 3)).toBeVisible();
    await expect(tab(t.tabs.available, 1)).toBeVisible();
    await expect(tab(t.tabs.failed, 2)).toBeVisible();
    await expect(card(2).getByRole("checkbox")).toBeChecked();
    await expect(card(2).getByText(t.line.chosen)).toBeVisible();
    await expect(card(3).getByRole("checkbox")).toBeDisabled();
  });

  await test.step("확인 필요 탭에서 수량 0 줄을 고친다 — 오류가 풀려도 줄이 탭에서 안 빠지고, 칸을 벗어나면 그 줄만 다시 맞춰 본다", async () => {
    await tab(t.tabs.failed, 2).click();
    await expect(qty(3)).toHaveValue("0");
    await qty(3).fill("2");
    await expect(card(3)).toBeVisible();
    await qty(3).blur();
    await expect(card(3).getByRole("checkbox")).toBeEnabled();
    await card(3).getByRole("checkbox").check();
    await tab(t.tabs.all, 3).click();
    await expect(page.getByRole("button", { name: t.actions.commitSelected(2) })).toBeVisible();
  });

  await test.step("새로고침해도 고친 줄이 남는다 (sessionStorage 보관) — 낡았을 수 있어 선택은 풀려 있고 [다시 맞춰 보기] 뒤에 다시 고른다", async () => {
    await page.reload();
    await expect(page.getByText(t.restored)).toBeVisible();
    await expect(qty(3)).toHaveValue("2");
    await expect(page.getByRole("button", { name: t.actions.commitSelected(0) })).toBeDisabled();
    await page.getByRole("button", { name: t.recheckAll }).click();
    await expect(card(3).getByRole("checkbox")).toBeEnabled();
    await page.getByRole("button", { name: t.selectVisible }).click();
    await expect(page.getByRole("button", { name: t.actions.commitSelected(2) })).toBeVisible();
  });

  await test.step("선택해서 담기 → 2건 담김, 담김 탭에 남고 4행(마스터 없음)은 그대로 남는다", async () => {
    await page.getByRole("button", { name: t.actions.commitSelected(2) }).click();
    await expect(page.getByText(t.done(2))).toBeVisible();
    await expect(page.getByText(t.doneHint)).toBeVisible();
    await tab(t.tabs.done, 2).click();
    await expect(card(2).getByText(t.line.added)).toBeVisible();
    await expect(card(2).getByRole("checkbox")).toBeDisabled();
  });

  await test.step("내 장바구니에 담은 줄이 있다", async () => {
    await page.goto("/my/cart");
    await expect(page.getByText(nameA).first()).toBeVisible();
    await expect(page.getByText(nameB).first()).toBeVisible();
  });
});
