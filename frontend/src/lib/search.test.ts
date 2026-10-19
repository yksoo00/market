import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  buildSearchHref,
  clearFilters,
  detailFilterCount,
  listingHref,
  parseSearchParams,
  searchApiParams,
  type SearchQuery,
} from "./search";

const q = (over: Partial<SearchQuery> = {}): SearchQuery => ({ ...parseSearchParams({}), ...over });

describe("parseSearchParams", () => {
  it("빈 파라미터면 기본값", () => {
    expect(parseSearchParams({})).toEqual({ q: "", field: "all", category: "", status: "available", mine: false, has: [] });
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
    const query = q({ q: "R740 2U", field: "brand", category: "E01-F01", status: "all", minStock: 0, minPrice: 100, maxPrice: 5_000_000, deliveryBy: "2026-11-01" });
    const href = buildSearchHref(query);
    expect(parseSearchParams(Object.fromEntries(new URLSearchParams(href.split("?")[1])))).toEqual(query);
  });
});

describe("activeFilterCount · clearFilters", () => {
  it("걸린 필터 개수", () => {
    expect(activeFilterCount(q({ q: "x", field: "brand" }))).toBe(0);
    expect(activeFilterCount(q({ status: "all", minPrice: 100 }))).toBe(2);
  });

  it("카테고리 코드도 센다. 보류 시절 URL 의 한글 카테고리는 읽을 때 버려져 세지 않는다", () => {
    expect(activeFilterCount(q({ category: "E01" }))).toBe(1);
    expect(activeFilterCount(parseSearchParams({ category: "서버" }))).toBe(0);
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

  it("카테고리는 코드로 보낸다 (2026-10-19 필터 복원), 옛 한글 값은 읽을 때 버려 안 보낸다", () => {
    expect(read(searchApiParams(q({ category: "E01-F01" }))).get("category")).toBe("E01-F01");
    expect(read(searchApiParams(parseSearchParams({ category: "서버" }))).has("category")).toBe(false);
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

describe("내 판매글 범위(mine)", () => {
  it("거래상태 기본값은 전체 — 거래완료한 내 글도 보여야 한다", () => {
    expect(parseSearchParams({}, "mine").status).toBe("all");
    expect(parseSearchParams({ status: "completed" }, "mine").status).toBe("completed");
    expect(parseSearchParams({ status: "bogus" }, "mine").status).toBe("all");
    // 검색 화면은 그대로
    expect(parseSearchParams({}).status).toBe("available");
  });

  it("주소는 /my/listings, 기본값(전체)은 생략하고 거래 가능만 status 를 붙인다", () => {
    const base = parseSearchParams({}, "mine");
    expect(buildSearchHref(base, "mine")).toBe("/my/listings");
    expect(buildSearchHref({ ...base, q: "R740" }, "mine")).toBe("/my/listings?q=R740");
    expect(buildSearchHref({ ...base, status: "available" }, "mine")).toBe("/my/listings?status=available");
    expect(buildSearchHref({ ...base, status: "completed" }, "mine")).toBe("/my/listings?status=completed");
    // 검색 화면은 그대로
    expect(buildSearchHref(parseSearchParams({}))).toBe("/search");
  });

  it("API 파라미터에 mine=true (검색 화면은 없음)", () => {
    const query = parseSearchParams({}, "mine");
    expect(new URLSearchParams(searchApiParams(query, undefined, "mine")).get("mine")).toBe("true");
    expect(new URLSearchParams(searchApiParams(query, undefined, "mine")).get("status")).toBe("all");
    expect(new URLSearchParams(searchApiParams(parseSearchParams({}))).has("mine")).toBe(false);
  });

  it("필터 개수·초기화도 범위 기본값 기준", () => {
    const base = parseSearchParams({}, "mine");
    expect(activeFilterCount(base, "mine")).toBe(0);
    expect(activeFilterCount({ ...base, status: "available" }, "mine")).toBe(1);
    expect(clearFilters({ ...base, status: "available", minStock: 3 }, "mine").status).toBe("all");
    expect(clearFilters({ ...q(), status: "completed" }).status).toBe("available");
  });
});

describe("검색 화면의 [전체 / 내 판매] (mine=1)", () => {
  it("mine=1 만 내 판매, 그 외 값·내 판매글 화면에선 무시", () => {
    expect(parseSearchParams({ mine: "1" }).mine).toBe(true);
    expect(parseSearchParams({}).mine).toBe(false);
    expect(parseSearchParams({ mine: "true" }).mine).toBe(false);
    expect(parseSearchParams({ mine: "1" }, "mine").mine).toBe(false);
  });

  it("URL 왕복 — 거래상태 기본값은 검색 그대로(거래 가능)", () => {
    const query = parseSearchParams({ mine: "1", q: "R740" });
    expect(query.status).toBe("available");
    expect(buildSearchHref(query)).toBe("/search?q=R740&mine=1");
    expect(buildSearchHref({ ...query, mine: false })).toBe("/search?q=R740");
  });

  it("API 에 mine=true — 본인 id 는 보내지 않는다", () => {
    const p = new URLSearchParams(searchApiParams(parseSearchParams({ mine: "1" })));
    expect(p.get("mine")).toBe("true");
    expect(p.get("status")).toBe("available");
  });

  it("필터가 아니라 개수에 안 세고, 초기화해도 남는다", () => {
    const query = parseSearchParams({ mine: "1", minStock: "3" });
    expect(activeFilterCount(query)).toBe(1);
    expect(clearFilters(query).mine).toBe(true);
  });
});

describe("상세 필터 (2026-10-19)", () => {
  it("URL 왕복 — 카테고리·상태·제조사·보증·불량지원·자료·최소주문", () => {
    const raw = {
      category: "P01-Q01",
      state: "80",
      brand: " Dell ",
      minWarranty: "360",
      coverage: "refund",
      has: "photo,datasheet",
      maxMinOrder: "5",
    };
    const query = parseSearchParams(raw);
    expect(query).toMatchObject({ category: "P01-Q01", state: "80", brand: "Dell", minWarranty: 360, coverage: "refund", maxMinOrder: 5 });
    // 자료는 정해진 순서로 — 같은 조건이 다른 URL 이 되지 않게
    expect(query.has).toEqual(["datasheet", "photo"]);
    expect(buildSearchHref(query)).toBe(
      "/search?category=P01-Q01&state=80&brand=Dell&minWarranty=360&coverage=refund&has=datasheet%2Cphoto&maxMinOrder=5",
    );
    expect(parseSearchParams(Object.fromEntries(new URLSearchParams(buildSearchHref(query).split("?")[1])))).toEqual(query);
  });

  it("잘못된 값은 버린다", () => {
    const query = parseSearchParams({
      category: "P01%",
      state: "95",
      brand: "   ",
      minWarranty: "100",
      coverage: "대체",
      has: "foo,photo",
      maxMinOrder: "0",
    });
    expect(query.category).toBe("");
    expect(query).not.toHaveProperty("state");
    expect(query).not.toHaveProperty("brand");
    expect(query).not.toHaveProperty("minWarranty");
    expect(query).not.toHaveProperty("coverage");
    expect(query).not.toHaveProperty("maxMinOrder");
    expect(query.has).toEqual(["photo"]);
    expect(parseSearchParams({ category: "P01-Q01-R001-S01" }).category).toBe("");
    expect(parseSearchParams({ maxMinOrder: "100001" })).not.toHaveProperty("maxMinOrder");
  });

  it("API 에 카테고리·상세 필터를 그대로 보낸다", () => {
    const p = new URLSearchParams(searchApiParams(parseSearchParams({ category: "E01", has: "certificate", state: "new" })));
    expect(p.get("category")).toBe("E01");
    expect(p.get("has")).toBe("certificate");
    expect(p.get("state")).toBe("new");
  });

  it("개수: 카테고리도 세고, 상세 필터는 따로도 센다 / 초기화는 전부 지운다", () => {
    const query = parseSearchParams({ category: "E01", brand: "Dell", has: "photo,datasheet", deliveryBy: "2026-12-01" });
    expect(activeFilterCount(query)).toBe(4);
    expect(detailFilterCount(query)).toBe(3);
    const cleared = clearFilters(query);
    expect(activeFilterCount(cleared)).toBe(0);
    expect(cleared.has).toEqual([]);
  });
});
