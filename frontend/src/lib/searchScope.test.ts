import { describe, expect, it } from "vitest";
import { parseSearchParams } from "./search";
import { scopeTabs, tabOf, withScope } from "./searchScope";

describe("scopeTabs — 내 데이터가 있는 범위만 탭이 생긴다", () => {
  it("판매만: 전체·내 판매", () => {
    expect(scopeTabs({ sales: true, purchases: false })).toEqual(["all", "mine"]);
  });

  it("구매만: 전체·내 구매", () => {
    expect(scopeTabs({ sales: false, purchases: true })).toEqual(["all", "purchased"]);
  });

  it("둘 다: 전체·내 판매·내 구매", () => {
    expect(scopeTabs({ sales: true, purchases: true })).toEqual(["all", "mine", "purchased"]);
  });

  it("둘 다 없음·아직 모름(비로그인·조회 실패)이면 탭 줄 없음", () => {
    expect(scopeTabs({ sales: false, purchases: false })).toEqual([]);
    expect(scopeTabs(null)).toEqual([]);
  });
});

describe("tabOf · withScope", () => {
  it("현재 범위를 읽고, 범위만 바꾸며 검색어·필터는 남긴다", () => {
    const query = parseSearchParams({ q: "R740", minStock: "3" });
    expect(tabOf(query)).toBe("all");
    const bought = withScope(query, "purchased");
    expect(tabOf(bought)).toBe("purchased");
    expect(bought).toMatchObject({ q: "R740", minStock: 3, mine: false, purchased: true });
    expect(withScope(bought, "mine")).toMatchObject({ mine: true, purchased: false });
    expect(withScope(bought, "all")).toMatchObject({ mine: false, purchased: false });
  });
});

describe("scopeTabs — 지금 보는 범위는 항상 탭에 있다", () => {
  it("주소로 바로 왔거나 조회 전·실패여도 내 구매 탭과 [전체]가 보인다", () => {
    expect(scopeTabs(null, "purchased")).toEqual(["all", "purchased"]);
    expect(scopeTabs({ sales: false, purchases: false }, "mine")).toEqual(["all", "mine"]);
    expect(scopeTabs({ sales: true, purchases: false }, "purchased")).toEqual(["all", "mine", "purchased"]);
  });
});

describe("withScope — 거래상태 기본값", () => {
  it("건드리지 않은 거래상태는 내 구매에서 전체, 다시 전체 검색으로 오면 거래 가능으로 따라간다", () => {
    const search = parseSearchParams({ q: "R740" });
    expect(search.status).toBe("available");
    const bought = withScope(search, "purchased");
    expect(bought.status).toBe("all");
    expect(withScope(bought, "all").status).toBe("available");
  });

  it("사용자가 고른 거래상태는 범위를 바꿔도 그대로", () => {
    const picked = parseSearchParams({ status: "completed" });
    expect(withScope(picked, "purchased").status).toBe("completed");
    const boughtPicked = parseSearchParams({ purchased: "1", status: "available" });
    expect(withScope(boughtPicked, "all").status).toBe("available");
  });
});
