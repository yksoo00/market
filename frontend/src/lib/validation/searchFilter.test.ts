import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@/lib/search";
import { search as t } from "@/messages/search";
import { filterDefaults, searchFilterSchema, type SearchFilterInput } from "./searchFilter";

const empty: SearchFilterInput = {
  category: "",
  status: "available",
  minStock: "",
  minPrice: "",
  maxPrice: "",
  deliveryBy: "",
  state: "",
  brand: "",
  minWarranty: "",
  coverage: "",
  has: [],
  maxMinOrder: "",
};
const parse = (over: Partial<SearchFilterInput>) => searchFilterSchema.safeParse({ ...empty, ...over });

/** 경로별 첫 오류 문구 */
const errors = (over: Partial<SearchFilterInput>) => {
  const r = parse(over);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("searchFilterSchema", () => {
  it("전부 빈 칸이면 성공, 숫자·날짜는 undefined", () => {
    const r = parse({});
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      category: "",
      status: "available",
      minStock: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      deliveryBy: undefined,
      state: undefined,
      brand: undefined,
      minWarranty: undefined,
      coverage: undefined,
      has: [],
      maxMinOrder: undefined,
    });
  });

  it("재고 0 ~ 100,000 정수", () => {
    expect(parse({ minStock: "0" }).data?.minStock).toBe(0);
    expect(parse({ minStock: "100000" }).data?.minStock).toBe(100_000);
    for (const bad of ["100001", "-1", "1.5"]) {
      expect(errors({ minStock: bad })).toEqual({ minStock: t.validation.stock });
    }
  });

  it("가격 0 ~ 10억 정수, 쉼표·음수 거부", () => {
    expect(parse({ minPrice: "0", maxPrice: "1000000000" }).data).toMatchObject({ minPrice: 0, maxPrice: 1_000_000_000 });
    for (const bad of ["1000000001", "1,000", "-5"]) {
      expect(errors({ minPrice: bad })).toEqual({ minPrice: t.validation.price });
    }
  });

  it("최소 가격 > 최대 가격이면 최대 가격 칸에 오류, 같으면 성공", () => {
    expect(errors({ minPrice: "500", maxPrice: "100" })).toEqual({ maxPrice: t.validation.priceOrder });
    expect(parse({ minPrice: "500", maxPrice: "500" }).success).toBe(true);
  });

  it("한쪽 가격 칸이 잘못됐으면 순서 오류를 다른 칸에 붙이지 않는다", () => {
    expect(errors({ minPrice: "abc", maxPrice: "5" })).toEqual({ minPrice: t.validation.price });
    expect(errors({ minPrice: "5", maxPrice: "1,000" })).toEqual({ maxPrice: t.validation.price });
  });

  it("없는 날짜는 오류", () => {
    expect(errors({ deliveryBy: "2026-02-30" })).toEqual({ deliveryBy: t.validation.date });
    expect(parse({ deliveryBy: "2026-10-31" }).data?.deliveryBy).toBe("2026-10-31");
  });
});

describe("filterDefaults", () => {
  it("URL 조건을 폼 값(문자열)으로", () => {
    expect(filterDefaults(parseSearchParams({ minPrice: "100" }))).toEqual({ ...empty, minPrice: "100" });
    expect(filterDefaults(parseSearchParams({ status: "all", category: "E01-F01", deliveryBy: "2026-10-31" }))).toEqual({
      ...empty,
      status: "all",
      category: "E01-F01",
      deliveryBy: "2026-10-31",
    });
    expect(filterDefaults(parseSearchParams({ state: "80", minWarranty: "360", has: "photo", maxMinOrder: "3" }))).toEqual({
      ...empty,
      state: "80",
      minWarranty: "360",
      has: ["photo"],
      maxMinOrder: "3",
    });
  });
});

describe("상세 필터 검증 (2026-10-19)", () => {
  it("제조사는 앞뒤 공백을 뺀 50자까지, 공백뿐이면 조건 없음", () => {
    expect(parse({ brand: `  ${"a".repeat(50)}  ` }).data?.brand).toBe("a".repeat(50));
    expect(errors({ brand: "a".repeat(51) })).toEqual({ brand: t.validation.brand });
    expect(parse({ brand: "   " }).data?.brand).toBeUndefined();
  });

  it("최소주문 1 ~ 100,000 정수", () => {
    expect(parse({ maxMinOrder: "1" }).data?.maxMinOrder).toBe(1);
    for (const bad of ["0", "100001", "1.5"]) {
      expect(errors({ maxMinOrder: bad })).toEqual({ maxMinOrder: t.validation.minOrder });
    }
  });

  it("고르는 칸은 목록 값만 — 상태·보증(일)·불량지원", () => {
    expect(parse({ state: "new", minWarranty: "1080", coverage: "replace" }).data).toMatchObject({ state: "new", minWarranty: 1080, coverage: "replace" });
    expect(parse({ state: "95" }).success).toBe(false);
    expect(parse({ minWarranty: "100" }).success).toBe(false);
    expect(parse({ coverage: "대체" }).success).toBe(false);
  });

  it("자료는 아는 키만, 정해진 순서로", () => {
    expect(parse({ has: ["photo", "foo", "datasheet"] }).data?.has).toEqual(["datasheet", "photo"]);
  });
});
