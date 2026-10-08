import { afterEach, describe, expect, it, vi } from "vitest";
import { startDateSchema } from "./business";

describe("startDateSchema", () => {
  afterEach(() => vi.useRealTimers());

  it("한국 날짜 기준 오늘 이전만 통과 (백엔드와 같은 규칙) — UTC 16:00 은 한국 다음 날 01:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
    expect(startDateSchema.safeParse("20261007").success).toBe(true);
    expect(startDateSchema.safeParse("20261008").success).toBe(false);
  });

  it("존재하지 않는 날짜는 거부", () => {
    expect(startDateSchema.safeParse("20230230").success).toBe(false);
  });
});
