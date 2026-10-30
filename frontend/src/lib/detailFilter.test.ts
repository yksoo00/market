import { describe, expect, it } from "vitest";
import { fieldIsEmpty, filterCount, filterParams, type FilterField } from "@/lib/detailFilter";

const fields: FilterField[] = [
  { kind: "dateRange", label: "기간", fromKey: "from", toKey: "to", fromLabel: "시작", toLabel: "끝" },
  { kind: "numberRange", label: "금액", minKey: "min", maxKey: "max", minLabel: "최소", maxLabel: "최대", suffix: "원" },
  { kind: "select", label: "정렬", key: "sort", defaultValue: "latest", options: [{ value: "latest", label: "최신" }, { value: "oldest", label: "오래된" }] },
];

describe("detailFilter", () => {
  it("전부 비었거나 기본값이면 걸린 칸이 없다", () => {
    expect(filterCount(fields, { q: "", from: "", to: "", min: "", max: "", sort: "latest" })).toBe(0);
    expect(filterCount(fields, {})).toBe(0);
  });

  it("기간·금액은 양끝 중 하나라도 있으면 1, 기본이 아닌 select 도 1", () => {
    expect(filterCount(fields, { from: "2026-10-01" })).toBe(1);
    expect(filterCount(fields, { from: "2026-10-01", to: "2026-10-05" })).toBe(1);
    expect(filterCount(fields, { from: "2026-10-01", max: "500", sort: "oldest" })).toBe(3);
    expect(fieldIsEmpty(fields[2], { sort: "oldest" })).toBe(false);
  });

  it("주소 파라미터는 빈 값·기본 정렬을 빼고 검색어는 앞뒤 공백을 자른다", () => {
    expect(filterParams(fields, { q: "  R740 ", from: "", to: "2026-10-05", min: "", max: "", sort: "latest" }, "q")).toEqual({
      q: "R740",
      to: "2026-10-05",
    });
    expect(filterParams(fields, { q: "", sort: "amountDesc" }, "q")).toEqual({ sort: "amountDesc" });
  });
});
