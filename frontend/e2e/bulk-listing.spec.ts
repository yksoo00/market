import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { home } from "@/messages/home";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { signup } from "@/messages/signup";
import { xlsx } from "./support/xlsx";

// 엑셀 판매상품 다량 등록 (계획 2026-11-05-bulk-listing-excel.md): 상품 하나를 직접 등록해 마스터를 만들고 → 홈 아이콘으로 모달을 열어
// 엑셀 3줄(마스터 찾음 · 수량 0 오류 · 새 마스터)을 올린다 → 오류 줄을 고치고 새 마스터 줄을 체크 → [선택 확정] → 3건 등록됨
const password = "Test1234!@";
const b = listing.bulk;
const p = listing.bulk.page;
const CATEGORY = "P01-Q01-R001"; // 인텔 CPU (대분류 PC주요부품 > CPU/프로세서 > 인텔 CPU)

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
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]{36}\/\d{14}$/);
}

/** 양식 헤더(*는 필수 표시) — 백엔드 ListingBulkParser.HEADER_LABELS 와 같은 순서 */
const HEADERS = ["상품명*", "제조사*", "분류번호", "상품번호", "카테고리 코드", "상품ID", "상품상태*", "단가*", "수량*", "최소주문수량", "주문단위", "제공가능일*", "설명"];

function line(name: string, quantity: string, category: string | null): (string | null)[] {
  const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return [name, "Dell", null, null, category, null, "신품", "20000", quantity, null, null, date, null];
}

test("엑셀 다량 등록 페이지: 올리고 → 탭·검색으로 보고 → 오류 줄을 고치고 → 새 상품은 직접 체크해 → 선택 확정 → 등록됨 탭", async ({ page }) => {
  const stamp = Date.now().toString().slice(-8);
  const seller = `e2ebk${stamp}`;
  const known = `E2E다량 ${stamp}`;
  const fresh = `E2E새상품 ${stamp}`;
  page.on("dialog", (d) => void d.accept());

  await test.step("가입·로그인·마스터가 될 상품 하나 등록", async () => {
    await signUp(page, seller, stamp);
    await logIn(page, seller);
    await register(page, known);
  });

  const card = (n: number) => page.getByRole("listitem").filter({ has: page.getByText(b.line.row(n), { exact: true }) });
  const tab = (name: string, count: number) => page.getByRole("tab", { name: `${name} ${count}` });

  // 칸의 이름이 오류 문구까지 포함해 읽히므로(label 이 입력 칸과 오류 문구를 함께 감싼다) 이름이 "수량"으로 시작하는 칸을 찾는다. "최소주문수량"과 안 겹치게 앞을 고정
  const qty = (n: number) =>
    card(n)
      .locator("label")
      .filter({ hasText: new RegExp(`^${b.fields.salesQuantity}`) })
      .locator("input");

  await test.step("홈 아이콘이 다량 등록 페이지로 가는 링크이고, 페이지에서 엑셀 3줄을 올린다 (대소문자가 다른 이름 · 수량 0 · 새 상품)", async () => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: home.quick.sellBulk })).toHaveAttribute("href", "/listings/bulk");
    await page.goto("/listings/bulk");
    await expect(page.getByRole("heading", { name: p.title })).toBeVisible();
    const file = xlsx([HEADERS, line(known.toUpperCase(), "3", null), line(`${known} 오류`, "0", CATEGORY), line(fresh, "2", CATEGORY)]);
    await page.locator('input[type="file"][accept=".xlsx"]').setInputFiles({
      name: "bulk.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: file,
    });
    // 2행: 마스터 찾음(체크됨), 3행: 수량 0 이라 확인 필요, 4행: 새 상품(체크 해제)
    await expect(tab(p.tabs.all, 3)).toBeVisible();
    await expect(tab(p.tabs.ok, 1)).toBeVisible();
    await expect(tab(p.tabs.new, 1)).toBeVisible();
    await expect(tab(p.tabs.failed, 1)).toBeVisible();
    await expect(card(2).getByRole("checkbox")).toBeChecked();
    await expect(card(3).getByRole("checkbox")).toBeDisabled();
  });

  await test.step("탭과 검색으로 줄을 걸러 본다", async () => {
    await tab(p.tabs.failed, 1).click();
    await expect(card(3)).toBeVisible();
    await expect(card(2)).toBeHidden();
    await tab(p.tabs.all, 3).click();
    await page.getByRole("searchbox", { name: p.searchLabel }).fill("새상품");
    await expect(card(4)).toBeVisible();
    await expect(card(2)).toBeHidden();
    await page.getByRole("searchbox", { name: p.searchLabel }).fill("");
    await expect(card(2)).toBeVisible();
  });

  await test.step("수량 0 인 3행을 고친다 — 칸을 벗어나면 그 줄만 다시 검사하고 체크를 풀어 둔다", async () => {
    // 확인 필요 탭에서 고친다 — 오류가 풀려도 줄이 탭에서 빠지지 않아야 계속 칠 수 있고 칸을 벗어날 때 재검사도 돈다 (코드리뷰)
    await tab(p.tabs.failed, 1).click();
    await expect(qty(3)).toHaveValue("0");
    await qty(3).fill("4");
    await expect(card(3)).toBeVisible();
    await qty(3).blur();
    await expect(card(3).getByRole("checkbox")).toBeEnabled();
    await card(3).getByRole("checkbox").check();
    await tab(p.tabs.all, 3).click();
  });

  await test.step("새 상품(4행)은 일부러 체크해야 등록된다", async () => {
    await expect(card(4).getByRole("checkbox")).not.toBeChecked();
    await card(4).getByRole("checkbox").check();
    await expect(page.getByRole("button", { name: b.actions.commitSelected(3) })).toBeVisible();
  });

  await test.step("새로고침해도 고친 줄·체크가 남는다 (sessionStorage 보관)", async () => {
    await page.reload();
    await expect(page.getByText(p.restored)).toBeVisible();
    await expect(qty(3)).toHaveValue("4");
    await expect(page.getByRole("button", { name: b.actions.commitSelected(3) })).toBeVisible();
  });

  await test.step("선택 확정 → 3건 등록됨, 등록됨 탭에 남는다", async () => {
    await page.getByRole("button", { name: b.actions.commitSelected(3) }).click();
    await expect(page.getByText(b.done(3))).toBeVisible();
    await expect(page.getByText(b.allDone)).toBeVisible();
    await tab(p.tabs.done, 3).click();
    await expect(card(2).getByText(p.committedBadge)).toBeVisible();
    await expect(card(2).getByRole("checkbox")).toBeDisabled();
  });
});
