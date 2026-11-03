import { expect, test } from "@playwright/test";
import { search } from "@/messages/search";

// 열 머리 정렬 (사용자 지시 2026-11-03): 열 머리를 누를 때마다 오름 → 내림 → 기본(최신순). 정렬 칩과 같은 sort 주소 값을 쓴다.
// 검색은 비로그인으로도 되고, 개발 DB 에 목록이 있으면(seed) 그 표로 확인한다 — 없으면 건너뛴다
test("검색 표 열 머리: 단가를 누르면 오름 → 내림 → 기본, 정렬 칩 글자가 같이 바뀐다", async ({ page }) => {
  await page.goto("/search");
  const price = page.getByRole("columnheader", { name: search.columns.price });
  // 목록은 불러온 뒤에 나온다 — 한참 기다려도 표가 없으면(매물 0건) 건너뛴다
  await price.waitFor({ timeout: 15_000 }).catch(() => undefined);
  if ((await price.count()) === 0) test.skip(true, "표에 보일 매물이 없다");
  // 칩 = "정렬: …" 버튼 (같은 칩의 [조건 지우기] 버튼과 구분)
  const chip = page.getByRole("button", { name: new RegExp(`^${search.sort.label}: `) });

  await expect(price).toHaveAttribute("aria-sort", "none");
  await price.getByRole("button").click();
  await expect(page).toHaveURL(/sort=priceAsc/);
  await expect(price).toHaveAttribute("aria-sort", "ascending");
  await expect(chip).toContainText(search.sort.options.priceAsc);

  await price.getByRole("button").click();
  await expect(page).toHaveURL(/sort=priceDesc/);
  await expect(price).toHaveAttribute("aria-sort", "descending");

  // 세 번째는 기본(최신순)으로 — sort 파라미터가 빠지고 등록일 열이 내림으로 보인다
  await price.getByRole("button").click();
  await expect(page).not.toHaveURL(/sort=/);
  await expect(price).toHaveAttribute("aria-sort", "none");
  await expect(page.getByRole("columnheader", { name: search.columns.regDate })).toHaveAttribute("aria-sort", "descending");
});

test("검색 표 열 머리: 상품명을 누르면 정렬 칩에 '상품명 ▲'가 보이고, 칩에서 최신순을 고르면 풀린다", async ({ page }) => {
  await page.goto("/search");
  const name = page.getByRole("columnheader", { name: search.columns.prodName });
  await name.waitFor({ timeout: 15_000 }).catch(() => undefined);
  if ((await name.count()) === 0) test.skip(true, "표에 보일 매물이 없다");

  await name.getByRole("button").click();
  await expect(page).toHaveURL(/sort=nameAsc/);
  await expect(name).toHaveAttribute("aria-sort", "ascending");
  const chip = page.getByRole("button", { name: search.sort.columnText(search.sort.columns.name, "asc"), exact: false });
  await expect(chip).toBeVisible();

  await chip.click();
  await page.getByRole("button", { name: search.sort.options.latest, exact: true }).click();
  await expect(page).not.toHaveURL(/sort=/);
  await expect(name).toHaveAttribute("aria-sort", "none");
});

// 가로로 넘치는 표 (사용자 지시 2026-11-03): 가로 스크롤바가 표 맨 아래가 아니라 화면 아래에 따라다니고,
// 오른쪽 끝 열 머리로 정렬해도 가로 위치가 처음으로 돌아가지 않는다
test("가로 스크롤: 스크롤바가 화면 아래에 따라다니고, 오른쪽 끝 열로 정렬해도 가로 위치가 유지된다", async ({ page }) => {
  await page.goto("/search");
  const regDate = page.getByRole("columnheader", { name: search.columns.regDate });
  await regDate.waitFor({ timeout: 15_000 }).catch(() => undefined);
  if ((await regDate.count()) === 0) test.skip(true, "표에 보일 매물이 없다");

  const scroller = () => page.locator("table").first().locator("xpath=..");
  // 표가 칸보다 넓으면(분할 칸) 진짜 스크롤바 대신 화면 아래에 붙는 막대가 보인다
  const bar = page.locator('div[aria-hidden="true"].sticky.bottom-0');
  if ((await bar.count()) === 0) test.skip(true, "표가 칸 안에 다 들어가 가로 스크롤이 없다");
  await expect(bar).toBeInViewport();

  // 오른쪽 끝 열(등록일)이 보이게 가로로 민다
  await regDate.scrollIntoViewIfNeeded();
  const before = await scroller().evaluate((el) => el.scrollLeft);
  expect(before).toBeGreaterThan(0);

  // 눌러서 정렬 → 표가 새로 그려져도 가로 위치는 그대로
  await regDate.getByRole("button").click();
  await expect(page).toHaveURL(/sort=regDateAsc/);
  await expect(page.getByRole("columnheader", { name: search.columns.regDate })).toHaveAttribute("aria-sort", "ascending");
  const after = await scroller().evaluate((el) => el.scrollLeft);
  expect(Math.abs(after - before)).toBeLessThan(8);
});

// 필터 칩 줄 (사용자 지시 2026-11-03): 칸이 좁아도 가로 스크롤바가 생기지 않고 줄을 바꾼다 — 열 정렬로 칩 글자가 길어져도
test("필터 칩 줄: 좁은 화면에서도 가로 스크롤 없이 줄바꿈된다 (긴 정렬 칩 글자 포함)", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto("/search?sort=minOrderAsc");
  const toolbar = page.getByRole("toolbar", { name: /./ }).first();
  await toolbar.waitFor({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: new RegExp(`^${search.sort.label}: `) })).toContainText(search.sort.columns.minOrder);
  const overflow = await toolbar.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
