import { describe, expect, it } from "vitest";
import { fitCount } from "./fitCount";

describe("fitCount", () => {
  it("높이에 온전히 들어가는 행 수만 센다 (잘린 행은 버림)", () => {
    expect(fitCount(56 * 4, 56)).toBe(4);
    expect(fitCount(56 * 4 + 55, 56)).toBe(4);
  });

  it("한 행도 안 들어가면 0", () => {
    expect(fitCount(30, 56)).toBe(0);
    expect(fitCount(0, 56)).toBe(0);
  });

  it("행 높이가 0 이하면 0 (측정 전 값)", () => {
    expect(fitCount(300, 0)).toBe(0);
  });
});
