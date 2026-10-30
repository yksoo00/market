import { describe, expect, it } from "vitest";
import { fieldIsEmpty, fieldKeys, filterCount, filterParams, groupCount, type FilterField } from "@/lib/detailFilter";

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

  it("검색 구분은 검색어가 있고 첫 선택지(기본)가 아닐 때만 주소에", () => {
    const scope = { key: "field", label: "구분", options: [{ value: "all", label: "전체" }, { value: "brand", label: "제조사" }] };
    expect(filterParams(fields, { q: "dell", field: "brand" }, "q", scope)).toEqual({ q: "dell", field: "brand" });
    expect(filterParams(fields, { q: "dell", field: "all" }, "q", scope)).toEqual({ q: "dell" });
    expect(filterParams(fields, { q: "", field: "brand" }, "q", scope)).toEqual({});
  });
});

describe("detailFilter 칸 종류 (검색 화면용)", () => {
  const group: FilterField = {
    kind: "group",
    label: "상세 필터",
    items: [
      { kind: "date", key: "deliveryBy", label: "납품일" },
      { kind: "text", key: "brand", label: "제조사" },
      { kind: "check", key: "has", label: "있는 것", options: [{ value: "photo", label: "사진" }] },
    ],
  };
  const custom: FilterField = { kind: "custom", label: "카테고리", keys: ["category"], render: () => null };
  const stock: FilterField = { kind: "numberMin", label: "재고", key: "minStock", suffix: "개 이상" };

  it("키는 칸이 쓰는 값 전부", () => {
    expect(fieldKeys(group)).toEqual(["deliveryBy", "brand", "has"]);
    expect(fieldKeys(custom)).toEqual(["category"]);
    expect(fieldKeys(stock)).toEqual(["minStock"]);
  });

  it("묶음은 걸린 칸 수를 세고, 하나도 없으면 비었다", () => {
    expect(fieldIsEmpty(group, { deliveryBy: "", brand: "", has: "" })).toBe(true);
    expect(groupCount(group as FilterField & { kind: "group" }, { deliveryBy: "2026-10-01", brand: "", has: "photo" })).toBe(2);
    expect(filterCount([group, custom, stock], { brand: "Dell", category: "E01", minStock: "" })).toBe(2);
  });

  it("검색어 없는 줄도 주소 파라미터는 걸린 칸만", () => {
    expect(filterParams([group, stock], { brand: "Dell", has: "photo,image", minStock: "3", deliveryBy: "" }, "q")).toEqual({
      brand: "Dell",
      has: "photo,image",
      minStock: "3",
    });
  });
});
