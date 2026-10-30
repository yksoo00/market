import { describe, expect, it } from "vitest";
import { historyApiParams, isRealDate, MAX_AMOUNT, MAX_Q, parseHistoryFilter } from "@/lib/historyFilter";
import { historyFilterSchema } from "@/lib/validation/historyFilter";

const base = { q: "", from: "", to: "", min: "", max: "", sort: "latest" };

describe("parseHistoryFilter (주소 → 필터)", () => {
  it("값이 없으면 전부 비고 정렬은 최신순", () => {
    expect(parseHistoryFilter({})).toEqual(base);
  });

  it("정상 값은 그대로, 검색어는 앞뒤 공백을 자른다", () => {
    expect(parseHistoryFilter({ q: " R740 ", from: "2026-10-01", to: "2026-10-31", min: "1000", max: "50000", sort: "amountDesc" })).toEqual({
      q: "R740",
      from: "2026-10-01",
      to: "2026-10-31",
      min: "1000",
      max: "50000",
      sort: "amountDesc",
    });
  });

  it("손으로 고친 틀린 값은 버린다 (서버 400 으로 목록이 깨지지 않게)", () => {
    const f = parseHistoryFilter({ from: "2026-02-30", to: "20261001", min: "-5", max: String(MAX_AMOUNT + 1), sort: "x", q: "가".repeat(MAX_Q + 1) });
    expect(f).toEqual(base);
  });

  it("뒤집힌 범위는 뒤쪽 값을 버린다", () => {
    expect(parseHistoryFilter({ from: "2026-10-10", to: "2026-10-01" })).toMatchObject({ from: "2026-10-10", to: "" });
    expect(parseHistoryFilter({ min: "500", max: "100" })).toMatchObject({ min: "500", max: "" });
  });

  it("같은 파라미터가 여러 번이면 첫 값", () => {
    expect(parseHistoryFilter({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("historyApiParams (필터 → API)", () => {
  it("값이 있는 것만, 금액은 minAmount·maxAmount, 기본 정렬은 안 보낸다", () => {
    expect(historyApiParams(base)).toEqual([]);
    expect(historyApiParams({ ...base, q: "R740", from: "2026-10-01", min: "10", max: "20", sort: "oldest" })).toEqual([
      ["q", "R740"],
      ["from", "2026-10-01"],
      ["minAmount", "10"],
      ["maxAmount", "20"],
      ["sort", "oldest"],
    ]);
  });
});

describe("isRealDate", () => {
  it("존재하는 날짜만", () => {
    expect(isRealDate("2026-10-30")).toBe(true);
    expect(isRealDate("2024-02-29")).toBe(true);
    expect(isRealDate("2026-02-29")).toBe(false);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("2026-1-1")).toBe(false);
  });
});

describe("historyFilterSchema (백엔드와 같은 수치)", () => {
  const ok = (v: Partial<typeof base>) => historyFilterSchema.safeParse({ ...base, ...v });

  it("빈 값과 경계값은 통과", () => {
    expect(ok({}).success).toBe(true);
    expect(ok({ q: "가".repeat(MAX_Q) }).success).toBe(true);
    expect(ok({ min: "0", max: String(MAX_AMOUNT) }).success).toBe(true);
    expect(ok({ from: "2026-10-05", to: "2026-10-05" }).success).toBe(true);
  });

  it("검색어 101자, 금액 범위 밖·숫자 아님, 잘못된 날짜, 정렬 밖 값은 실패", () => {
    expect(ok({ q: "가".repeat(MAX_Q + 1) }).success).toBe(false);
    expect(ok({ min: String(MAX_AMOUNT + 1) }).success).toBe(false);
    expect(ok({ max: "-1" }).success).toBe(false);
    expect(ok({ max: "1.5" }).success).toBe(false);
    expect(ok({ from: "2026-02-30" }).success).toBe(false);
    expect(ok({ sort: "x" }).success).toBe(false);
  });

  it("앞뒤가 뒤집힌 기간·금액은 뒤 칸에 오류가 붙는다", () => {
    const d = ok({ from: "2026-10-10", to: "2026-10-09" });
    expect(d.success).toBe(false);
    expect(!d.success && d.error.issues[0].path).toEqual(["to"]);
    const a = ok({ min: "500", max: "100" });
    expect(!a.success && a.error.issues[0].path).toEqual(["max"]);
  });
});
