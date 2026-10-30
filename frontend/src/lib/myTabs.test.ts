import { describe, expect, it } from "vitest";
import { parseActivityTab, parseHistoryTab, parsePage, parseReg, tabPageHref } from "./myTabs";

describe("parseActivityTab", () => {
  it("알려진 탭은 그대로, 없거나 모르는 값은 요청 탭", () => {
    expect(parseActivityTab("sales")).toBe("sales");
    expect(parseActivityTab("purchases")).toBe("purchases");
    expect(parseActivityTab(undefined)).toBe("requests");
    expect(parseActivityTab("bogus")).toBe("requests");
    expect(parseActivityTab(["sales", "purchases"])).toBe("sales");
  });
});

describe("parseHistoryTab", () => {
  it("알려진 탭은 그대로, 없거나 모르는 값은 전체", () => {
    expect(parseHistoryTab("buy")).toBe("buy");
    expect(parseHistoryTab("sell")).toBe("sell");
    expect(parseHistoryTab(undefined)).toBe("all");
    expect(parseHistoryTab("x")).toBe("all");
  });
});

describe("parseReg", () => {
  it("14자리 숫자만 매물 거르기 값으로 본다", () => {
    expect(parseReg("20261015100000")).toBe("20261015100000");
    expect(parseReg("2026101510")).toBeUndefined();
    expect(parseReg("20261015100000x")).toBeUndefined();
    expect(parseReg(undefined)).toBeUndefined();
  });
});

describe("parsePage", () => {
  it("1 이상 정수만, 그 밖은 1페이지", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2x")).toBe(1);
    expect(parsePage("99999999")).toBe(1);
  });
});

describe("tabPageHref", () => {
  it("1페이지는 page 를 생략하고 빈 값은 뺀다", () => {
    expect(tabPageHref("/my/activity", { tab: "requests", reg: undefined }, 1)).toBe("/my/activity?tab=requests");
    expect(tabPageHref("/my/activity", { tab: "requests", reg: "20261015100000" }, 3)).toBe("/my/activity?tab=requests&reg=20261015100000&page=3");
  });
});
