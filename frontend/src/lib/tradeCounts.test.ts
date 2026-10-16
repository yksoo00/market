import { describe, expect, it } from "vitest";
import { pendingLabel, salesHref } from "./tradeCounts";

describe("pendingLabel", () => {
  it("요청이 있으면 N건, 없거나 0이면 null", () => {
    expect(pendingLabel({ "20261015100000": 2 }, "20261015100000")).toBe("2건");
    expect(pendingLabel({ "20261015100000": 0 }, "20261015100000")).toBeNull();
    expect(pendingLabel({}, "20261015100000")).toBeNull();
    expect(pendingLabel(null, "20261015100000")).toBeNull();
  });
});

describe("salesHref", () => {
  it("받은 구매요청을 그 매물로 걸러 연다", () => {
    expect(salesHref("20261015100000")).toBe("/my/sales?reg=20261015100000");
  });
});
