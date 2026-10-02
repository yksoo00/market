import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  buildSearchHref,
  clearFilters,
  listingHref,
  parseSearchParams,
  searchApiParams,
  type SearchQuery,
} from "./search";

const q = (over: Partial<SearchQuery> = {}): SearchQuery => ({ ...parseSearchParams({}), ...over });

describe("parseSearchParams", () => {
  it("빈 파라미터면 기본값", () => {
    expect(parseSearchParams({})).toEqual({ q: "", field: "all", category: "", status: "available" });
  });

  it("검색어 앞뒤 공백을 지우고, 공백뿐이면 빈 검색어", () => {
    expect(parseSearchParams({ q: "  LM324  " }).q).toBe("LM324");
    expect(parseSearchParams({ q: "   " }).q).toBe("");
  });

  it("검색어가 100자를 넘으면 100자로 자른다", () => {
    expect(parseSearchParams({ q: "a".repeat(150) }).q).toBe("a".repeat(100));
    expect(parseSearchParams({ q: `${"a".repeat(99)} b` }).q).toBe("a".repeat(99));
  });

  it("검색 구분·거래상태의 모르는 값은 기본값", () => {
    expect(parseSearchParams({ field: "brand" }).field).toBe("brand");
    expect(parseSearchParams({ field: "name" }).field).toBe("name");
    expect(parseSearchParams({ field: "x" }).field).toBe("all");
    expect(parseSearchParams({ status: "bogus" }).status).toBe("available");
    expect(parseSearchParams({ status: "all" }).status).toBe("all");
  });

  it("같은 파라미터가 여러 번이면 첫 값", () => {
    expect(parseSearchParams({ status: ["completed", "all"] }).status).toBe("completed");
    expect(parseSearchParams({ q: ["a", "b"] }).q).toBe("a");
  });

  it("재고는 0 ~ 100,000 정수만, 아니면 무시", () => {
    expect(parseSearchParams({ minStock: "0" }).minStock).toBe(0);
    expect(parseSearchParams({ minStock: "100000" }).minStock).toBe(100_000);
    for (const bad of ["-1", "abc", "100001", "1.5", ""]) {
      expect(parseSearchParams({ minStock: bad }).minStock).toBeUndefined();
    }
  });

  it("가격은 0 ~ 10억 정수만, 아니면 무시", () => {
    expect(parseSearchParams({ maxPrice: "1000000000" }).maxPrice).toBe(1_000_000_000);
    expect(parseSearchParams({ maxPrice: "1000000001" }).maxPrice).toBeUndefined();
    expect(parseSearchParams({ minPrice: "1,000" }).minPrice).toBeUndefined();
  });

  it("최소 가격 > 최대 가격인 URL이면 가격 조건을 둘 다 버림 (폼이 처음부터 막히지 않게)", () => {
    const query = parseSearchParams({ minPrice: "500000", maxPrice: "1000" });
    expect(query.minPrice).toBeUndefined();
    expect(query.maxPrice).toBeUndefined();
    expect(parseSearchParams({ minPrice: "500", maxPrice: "500" })).toMatchObject({ minPrice: 500, maxPrice: 500 });
  });

  it("납품일은 실제 있는 YYYY-MM-DD만", () => {
    expect(parseSearchParams({ deliveryBy: "2026-10-31" }).deliveryBy).toBe("2026-10-31");
    expect(parseSearchParams({ deliveryBy: "2026-02-30" }).deliveryBy).toBeUndefined();
    expect(parseSearchParams({ deliveryBy: "2026/10/01" }).deliveryBy).toBeUndefined();
  });
});

describe("buildSearchHref", () => {
  it("기본값만이면 /search", () => {
    expect(buildSearchHref(q())).toBe("/search");
  });

  it("URL로 만들었다 다시 읽으면 같은 조건", () => {
    const query = q({ q: "R740 2U", field: "brand", category: "서버", status: "all", minStock: 0, minPrice: 100, maxPrice: 5_000_000, deliveryBy: "2026-11-01" });
    const href = buildSearchHref(query);
    expect(parseSearchParams(Object.fromEntries(new URLSearchParams(href.split("?")[1])))).toEqual(query);
  });
});

describe("activeFilterCount · clearFilters", () => {
  it("걸린 필터 개수", () => {
    expect(activeFilterCount(q({ q: "x", field: "brand" }))).toBe(0);
    expect(activeFilterCount(q({ status: "all", minPrice: 100 }))).toBe(2);
  });

  it("카테고리는 보류 중이라 세지 않는다 (예전 URL 의 category)", () => {
    expect(activeFilterCount(q({ category: "서버" }))).toBe(0);
  });

  it("초기화는 검색어·구분만 남김", () => {
    expect(clearFilters(q({ q: "x", field: "brand", category: "서버", minStock: 1, deliveryBy: "2026-10-10" }))).toEqual(
      q({ q: "x", field: "brand" }),
    );
  });
});

describe("listingHref", () => {
  it("상세 경로", () => {
    expect(listingHref({ userId: "u1", regDate: "20261001090000" })).toBe("/listings/u1/20261001090000");
  });
});

describe("searchApiParams", () => {
  const read = (s: string) => new URLSearchParams(s);

  it("기본 조건은 status 만", () => {
    expect(searchApiParams(q())).toBe("status=available");
  });

  it("카테고리는 보내지 않는다 (카테고리 마스터 미정, decisions.md 2026-10-02)", () => {
    expect(read(searchApiParams(q({ category: "서버" }))).has("category")).toBe(false);
  });

  it("field 는 all 이면 생략, 아니면 포함", () => {
    expect(read(searchApiParams(q())).has("field")).toBe(false);
    expect(read(searchApiParams(q({ field: "brand" }))).get("field")).toBe("brand");
  });

  it("필터·커서를 담고 검색어는 인코딩된다", () => {
    const p = read(
      searchApiParams(q({ q: "Dell R740", minPrice: 10, maxPrice: 20, minStock: 0, deliveryBy: "2026-10-10", status: "all" }), "c1"),
    );
    expect(p.get("q")).toBe("Dell R740");
    expect(p.get("minPrice")).toBe("10");
    expect(p.get("maxPrice")).toBe("20");
    expect(p.get("minStock")).toBe("0");
    expect(p.get("deliveryBy")).toBe("2026-10-10");
    expect(p.get("status")).toBe("all");
    expect(p.get("cursor")).toBe("c1");
  });
});
