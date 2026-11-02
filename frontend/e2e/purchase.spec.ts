import { expect, test, type Page } from "@playwright/test";
import { auth } from "@/messages/auth";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { signup } from "@/messages/signup";
import { trade } from "@/messages/trade";

// 구매 흐름: 판매자 등록 → 구매자 [구매] 모달로 요청 → 내 구매목록 [거래완료] → 다시 요청 → 판매자가 받은 구매요청에서 [취소].
// 가입이 2번(판매자·구매자)
const password = "Test1234!@";
const t = trade.list;
// 한 줄에 다 안 들어가는 길이의 요청사항 (표에선 잘린다)
const LONG_REMARKS = "납품 전에 설치 일정과 담당자 연락처를 먼저 알려 주세요. 가능하면 오전 중에 받고 싶습니다. 포장은 파손 방지로 꼼꼼히 부탁드립니다.".slice(0, 100);

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

async function requestPurchase(page: Page, listingPath: string, quantity: string, remarks?: string) {
  await page.goto(listingPath);
  await page.getByRole("button", { name: listing.detail.buy, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: trade.purchase.title });
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole("button", { name: trade.purchase.submit, exact: true });
  await dialog.locator('input[name="orderQuantity"]').fill(quantity);
  // 납품희망일은 제공가능일이 기본값으로 채워진다 — 다른 날짜로 바꿔 본다
  await dialog.locator('input[name="reqDeliDate"]').fill(daysLater(7));
  if (remarks) await dialog.locator('input[name="remarks"]').fill(remarks);
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
    // 제공가능일 필수 (2026-10-27)
    await page.locator('input[name="deliveryDate"]').fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
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
    await requestPurchase(page, listingPath, "2", LONG_REMARKS);
  });

  await test.step("내 구매목록 — 구매요청 → [거래완료] → 구매확정", async () => {
    await page.goto("/my/activity?tab=purchases");
    const row = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    await expect(row.getByText(t.stats.requested)).toBeVisible();
    // 요청사항은 표에서 한 줄로 잘려 있고, 누르면 전체 글이 팝업으로 보인다
    await row.getByRole("button", { name: t.remarksView(prodName) }).click();
    const remarksDialog = page.getByRole("dialog", { name: t.remarksLabel });
    await expect(remarksDialog.getByText(LONG_REMARKS)).toBeVisible();
    await remarksDialog.getByRole("button", { name: t.remarksClose }).click();
    await expect(remarksDialog).toBeHidden();
    // 검색·상세 필터: 없는 이름은 빈 결과 → [필터 초기화], 상태·상품명 조건은 그대로 보인다
    const af = my.activityFilter;
    const hf = my.history.filter;
    const searchBox = page.getByRole("searchbox", { name: af.label });
    await searchBox.fill("zzz-없는상품");
    await page.getByRole("button", { name: hf.search, exact: true }).click();
    await expect(page.getByText(af.emptyTitle)).toBeVisible();
    await page.getByRole("button", { name: hf.reset }).click();
    await expect(row).toBeVisible();
    await searchBox.fill(prodName);
    await page.getByRole("button", { name: hf.search, exact: true }).click();
    // 적용하면 목록이 다시 마운트된다 — 건수 줄이 보여야 새 목록이다
    await expect(page.getByText(hf.resultCount(1))).toBeVisible();
    // 상태 칩: 누르면 목록에서 바로 고른다 (구매요청 상태인 이 줄은 견적수락으로 거르면 사라진다)
    await page.getByRole("button", { name: af.status, exact: true }).click();
    await page.getByRole("button", { name: t.stats.quoteAccepted, exact: true }).click();
    await expect(page.getByText(af.emptyTitle)).toBeVisible();
    await page.getByRole("button", { name: hf.reset }).click();
    await expect(row).toBeVisible();
    await page.getByRole("button", { name: t.completeAria(prodName) }).click();
    await expect(row.getByText(t.stats.confirmed)).toBeVisible();
    await expect(page.getByRole("button", { name: t.completeAria(prodName) })).toHaveCount(0);
  });

  await test.step("확정된 거래 — 내 활동내역에선 빠지고 내 거래이력에 남고, 검색 [내 구매]에서 그 매물이 보인다", async () => {
    await page.goto("/my/activity?tab=purchases");
    await expect(page.getByText(my.purchases.emptyTitle)).toBeVisible();
    await page.goto("/my/history?tab=buy");
    const historyRow = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    await expect(historyRow).toBeVisible();
    // 거래이력 검색·상세 필터: 없는 이름은 빈 결과 → [필터 초기화] 로 돌아오고, 맞는 이름·금액 조건은 그대로 보인다
    const hf = my.history.filter;
    const searchBox = page.getByRole("searchbox", { name: hf.label });
    await searchBox.fill("zzz-없는상품");
    await page.getByRole("button", { name: hf.search, exact: true }).click();
    await expect(page.getByText(hf.emptyTitle)).toBeVisible();
    await page.getByRole("button", { name: hf.reset }).click();
    await expect(historyRow).toBeVisible();
    await searchBox.fill(prodName);
    await page.getByRole("button", { name: hf.search, exact: true }).click();
    // 적용하면 목록이 다시 마운트된다 — 건수 줄이 보여야 새 목록이다 (옛 줄이 남아 있는 동안 누르면 팝업이 같이 사라진다)
    await expect(page.getByText(hf.resultCount(1))).toBeVisible();
    await expect(historyRow).toBeVisible();
    // 금액 칩: 팝업에 최소 금액을 넣고 [적용]
    await page.getByRole("button", { name: hf.amount, exact: true }).click();
    await page.getByRole("textbox", { name: hf.minAmount }).fill("2000000000");
    await page.getByRole("button", { name: hf.apply, exact: true }).click();
    await expect(page.getByText(hf.emptyTitle)).toBeVisible();
    await page.getByRole("button", { name: hf.reset }).click();
    await expect(historyRow).toBeVisible();
    await page.goto("/search");
    await page.getByRole("link", { name: search.scope.purchased }).click();
    await expect(page).toHaveURL(/purchased=1/);
    await expect(page.getByRole("table").getByRole("row").filter({ hasText: prodName })).toBeVisible();
  });

  await test.step("다시 1개 요청 → 판매자 내 판매글에 1건 → 받은 구매요청에서 [취소]", async () => {
    await requestPurchase(page, listingPath, "1");
    await logOut(page);
    await logIn(page, seller);
    await page.goto("/my/activity?tab=sales");
    const listingRow = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    // 건수를 누르면 요청 탭이 그 매물로 걸러져 같은 칸에서 열린다 — 내 활동내역은 한 화면이라 칸을 더 쌓지 않는다
    await listingRow.getByRole("button", { name: trade.pending.aria(prodName, 1) }).click();
    await expect(page).toHaveURL(/\/my\/activity\?tab=requests&reg=\d{14}$/);
    await expect(page.getByText(my.sales.filtered)).toBeVisible();

    await page.goto("/my/activity?tab=requests");
    const pendingRow = page.getByRole("table").getByRole("row").filter({ hasText: t.stats.requested });
    await expect(pendingRow).toHaveCount(1);
    // 판매자는 [거래완료]가 없고 [취소]만
    await expect(page.getByRole("button", { name: t.completeAria(prodName) })).toHaveCount(0);
    await page.getByRole("button", { name: t.cancelAria(prodName) }).click();
    // 취소하면 거래 행이 지워진다 (2026-10-20) — 구매요청 줄은 사라진다. 내 활동내역은 진행 중만이라 확정된 줄은 원래 없다(내 거래이력에서)
    await expect(pendingRow).toHaveCount(0);
    await expect(page.getByText(my.sales.emptyTitle)).toBeVisible();
  });

  // 넓은 화면 표에는 재고 열이 없다 — 재고가 0이 되는 구매로 행이 바로 "거래완료"가 되는지 본다
  await test.step("검색 결과에서 남은 재고(3)를 다 사면 그 행이 바로 거래완료로 바뀐다", async () => {
    await logOut(page);
    await logIn(page, buyer);
    await page.goto(`/search?q=${encodeURIComponent(prodName)}`);
    const row = page.getByRole("table").getByRole("row").filter({ hasText: prodName });
    await expect(row.getByText(search.result.completedBadge)).toHaveCount(0);
    await row.getByRole("checkbox", { name: search.result.selectRow(prodName) }).check();
    await page.getByRole("button", { name: search.result.buy, exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: trade.purchase.title });
    await dialog.locator('input[name="orderQuantity"]').fill("3");
    await dialog.locator('input[name="reqDeliDate"]').fill(daysLater(7));
    await dialog.getByRole("button", { name: trade.purchase.submit, exact: true }).click();
    await expect(page.getByRole("dialog", { name: trade.purchase.doneTitle })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(row.getByText(search.result.completedBadge)).toBeVisible();
  });
});
