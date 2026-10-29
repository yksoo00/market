import { describe, expect, it } from "vitest";
import { parseActivityTab, parseHistoryTab, parseReg } from "./myTabs";

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
