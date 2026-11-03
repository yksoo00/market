import { describe, expect, it } from "vitest";
import { historyApiParams, historySortColumn, isRealDate, MAX_AMOUNT, MAX_Q, parseHistoryFilter } from "@/lib/historyFilter";
import { historyFilterSchema } from "@/lib/validation/historyFilter";

const base = { q: "", field: "all", from: "", to: "", min: "", max: "", sort: "latest" };

describe("parseHistoryFilter (주소 → 필터)", () => {
  it("값이 없으면 전부 비고 정렬은 최신순", () => {
    expect(parseHistoryFilter({})).toEqual(base);
  });

  it("정상 값은 그대로, 검색어는 앞뒤 공백을 자른다", () => {
    expect(parseHistoryFilter({ q: " R740 ", from: "2026-10-01", to: "2026-10-31", min: "1000", max: "50000", sort: "amountDesc" })).toEqual({
      q: "R740",
      field: "all",
      from: "2026-10-01",
      to: "2026-10-31",
      min: "1000",
      max: "50000",
      sort: "amountDesc",
    });
  });

  it("손으로 고친 틀린 값은 버린다 (서버 400 으로 목록이 깨지지 않게)", () => {
    const f = parseHistoryFilter({ from: "2026-02-30", to: "20261001", min: "-5", max: String(MAX_AMOUNT + 1), sort: "x", q: "가".repeat(MAX_Q + 1), field: "prodNo" });
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
    expect(historyApiParams({ ...base, q: "R740", from: "2026-10-01", min: "10", max: "20", sort: "amountDesc" })).toEqual([
      ["q", "R740"],
      ["from", "2026-10-01"],
      ["minAmount", "10"],
      ["maxAmount", "20"],
      ["sort", "amountDesc"],
    ]);
  });

  it("검색 구분은 검색어가 있고 전체가 아닐 때만", () => {
    expect(historyApiParams({ ...base, field: "brand" })).toEqual([]);
    expect(historyApiParams({ ...base, q: "dell", field: "all" })).toEqual([["q", "dell"]]);
    expect(historyApiParams({ ...base, q: "dell", field: "brand" })).toEqual([
      ["q", "dell"],
      ["field", "brand"],
    ]);
  });
});

describe("정렬 (열 머리 정렬 2026-11-03)", () => {
  it("열마다 오름·내림 값과 오래된순이 주소에서 읽히고, 모르는 값은 최신순", () => {
    expect(parseHistoryFilter({ sort: "oldest" }).sort).toBe("oldest");
    expect(parseHistoryFilter({ sort: "partyDesc" }).sort).toBe("partyDesc");
    expect(parseHistoryFilter({ sort: "nameAsc" }).sort).toBe("nameAsc");
    expect(parseHistoryFilter({ sort: "reqDeliAsc" }).sort).toBe("latest");
  });

  it("historySortColumn: sort 값 → 열·방향, 열 정렬이 아니면 null (기본은 확정일시 내림)", () => {
    expect(historySortColumn("unitPriceAsc")).toEqual({ column: "unitPrice", dir: "asc" });
    expect(historySortColumn("oldest")).toEqual({ column: "date", dir: "asc" });
    expect(historySortColumn("latest")).toEqual({ column: "date", dir: "desc" });
    expect(historySortColumn("bogus")).toBeNull();
  });
});

describe("parseHistoryFilter 검색 구분", () => {
  it("all·name·brand 만, 나머지는 all", () => {
    expect(parseHistoryFilter({ field: "name" }).field).toBe("name");
    expect(parseHistoryFilter({ field: "brand" }).field).toBe("brand");
    expect(parseHistoryFilter({ field: "x" }).field).toBe("all");
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
    expect(ok({ field: "x" }).success).toBe(false);
  });

  it("앞뒤가 뒤집힌 기간·금액은 뒤 칸에 오류가 붙는다", () => {
    const d = ok({ from: "2026-10-10", to: "2026-10-09" });
    expect(d.success).toBe(false);
    expect(!d.success && d.error.issues[0].path).toEqual(["to"]);
    const a = ok({ min: "500", max: "100" });
    expect(!a.success && a.error.issues[0].path).toEqual(["max"]);
  });
});
