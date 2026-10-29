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
