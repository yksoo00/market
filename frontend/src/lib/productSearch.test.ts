import { describe, expect, it } from "vitest";
import { applyFilter, buildProductSearchParams, clampPage, initialProductFilter, type ProductFilter } from "./productSearch";

const f = (patch: Partial<ProductFilter> = {}): ProductFilter => ({ ...initialProductFilter, ...patch });

describe("buildProductSearchParams", () => {
  it("빈 조건은 쿼리에서 빠지고 page 만 남는다", () => {
    expect(buildProductSearchParams(f())).toBe("page=1");
  });

  it("값은 앞뒤 공백을 떼고 인코딩한다", () => {
    expect(buildProductSearchParams(f({ q: "  노트북 A&B ", category: "P01-Q01", brand: "Dell", page: 3 }))).toBe(
      "q=%EB%85%B8%ED%8A%B8%EB%B6%81+A%26B&category=P01-Q01&brand=Dell&page=3",
    );
  });

  it("공백뿐인 조건은 없는 것으로 본다", () => {
    expect(buildProductSearchParams(f({ q: "   ", brand: " " }))).toBe("page=1");
  });
});

describe("clampPage", () => {
  it("1 ~ totalPages 안으로 맞춘다 (결과가 비어도 1페이지는 있다)", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(2, 0)).toBe(1);
  });
});

describe("applyFilter", () => {
  it("검색어·카테고리·제조사를 바꾸면 1페이지로 돌아간다", () => {
    expect(applyFilter(f({ page: 4, q: "a" }), { q: "ab" }).page).toBe(1);
    expect(applyFilter(f({ page: 4 }), { category: "P01" }).page).toBe(1);
    expect(applyFilter(f({ page: 4 }), { brand: "dell" }).page).toBe(1);
  });

  it("페이지만 바꾸면 조건은 그대로 두고 그 페이지로 간다", () => {
    expect(applyFilter(f({ q: "a", category: "P01", brand: "d", page: 1 }), { page: 3 })).toEqual({ q: "a", category: "P01", brand: "d", page: 3 });
  });

  it("값이 그대로면 페이지를 건드리지 않는다 (같은 값을 다시 눌러 1페이지로 튀지 않게)", () => {
    expect(applyFilter(f({ q: "a", page: 4 }), { q: "a" }).page).toBe(4);
  });
});
