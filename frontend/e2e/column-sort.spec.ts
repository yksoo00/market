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
