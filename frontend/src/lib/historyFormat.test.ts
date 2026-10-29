import { describe, expect, it } from "vitest";
import { formatTradeDate } from "./historyFormat";

describe("formatTradeDate", () => {
  it("14자리 확정일시를 날짜와 분까지 보인다", () => {
    expect(formatTradeDate("20261015123045")).toBe("2026-10-15 12:30");
  });

  it("형식이 틀린 값은 그대로 돌려준다", () => {
    expect(formatTradeDate("2026-10-15")).toBe("2026-10-15");
    expect(formatTradeDate("")).toBe("");
  });
});
