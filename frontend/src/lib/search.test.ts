import { describe, expect, it } from "vitest";
import type { ListingSearchItem } from "@/types/listing";
import {
  activeFilterCount,
  buildSearchHref,
  clearFilters,
  filterListings,
  listingHref,
  parseSearchParams,
  type SearchQuery,
} from "./search";

const base: ListingSearchItem = {
  userId: "u1",
  regDate: "20261001090000",
  prodNo: "LM324AD",
  prodName: "LM324AD 쿼드 OP앰프",
  prodBrand: "STMICROELECTRONICS",
  category: "기타",
  description: null,
  hasDataSheet: true,
  hasPhoto: true,
  prodState: "양호",
  stockQuantity: 500,
  salesUnitPrice: 320,
  deliveryDate: "2026-10-10",
  tradeStatus: "available",
};

const item = (over: Partial<ListingSearchItem>): ListingSearchItem => ({ ...base, ...over });

const items: ListingSearchItem[] = [
  base,
  item({ regDate: "2", prodNo: "PER740", prodName: "PowerEdge R740", prodBrand: "Dell", category: "서버", stockQuantity: 2, salesUnitPrice: 3_500_000, deliveryDate: "2026-10-20" }),
  item({ regDate: "3", prodNo: null, prodName: "Catalyst 9300 48P", prodBrand: "Cisco", category: "네트워크", stockQuantity: 10, salesUnitPrice: 1_900_000, deliveryDate: null }),
  item({ regDate: "4", prodNo: "RTX4090", prodName: "RTX 4090 24GB", prodBrand: "NVIDIA", category: "GPU", stockQuantity: 0, salesUnitPrice: 2_450_000, tradeStatus: "completed" }),
];

const q = (over: Partial<SearchQuery> = {}): SearchQuery => ({ ...parseSearchParams({}), ...over });
const regDates = (list: ListingSearchItem[]) => list.map((i) => i.regDate);

describe("parseSearchParams", () => {
  it("빈 파라미터면 기본값", () => {
    expect(parseSearchParams({})).toEqual({ q: "", field: "name", category: "", status: "available" });
  });

  it("검색어 앞뒤 공백을 지우고, 공백뿐이면 빈 검색어", () => {
    expect(parseSearchParams({ q: "  LM324  " }).q).toBe("LM324");
    expect(parseSearchParams({ q: "   " }).q).toBe("");
  });

  it("검색 구분·거래상태의 모르는 값은 기본값", () => {
    expect(parseSearchParams({ field: "brand" }).field).toBe("brand");
    expect(parseSearchParams({ field: "x" }).field).toBe("name");
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

describe("filterListings", () => {
  it("조건이 없으면 거래 가능 전부", () => {
    expect(regDates(filterListings(items, q()))).toEqual(["20261001090000", "2", "3"]);
  });

  it("상품명 검색은 상품명·상품번호 부분 일치, 대소문자 무시", () => {
    expect(regDates(filterListings(items, q({ q: "lm324" })))).toEqual(["20261001090000"]);
    expect(regDates(filterListings(items, q({ q: "per7" })))).toEqual(["2"]);
  });

  it("검색어를 띄어쓰기로 나눠 모든 낱말이 들어 있으면 매칭 (순서 무관)", () => {
    expect(regDates(filterListings(items, q({ q: "48p catalyst" })))).toEqual(["3"]);
    expect(regDates(filterListings(items, q({ q: "R740  poweredge" })))).toEqual(["2"]);
    expect(filterListings(items, q({ q: "catalyst R740" }))).toEqual([]);
  });

  it("상품번호가 없어도 상품명으로 매칭", () => {
    expect(regDates(filterListings(items, q({ q: "catalyst" })))).toEqual(["3"]);
  });

  it("제조사 검색은 제조사만 본다", () => {
    expect(regDates(filterListings(items, q({ q: "dell", field: "brand" })))).toEqual(["2"]);
    expect(filterListings(items, q({ q: "PowerEdge", field: "brand" }))).toEqual([]);
  });

  it("거래상태: completed만, all이면 전부", () => {
    expect(regDates(filterListings(items, q({ status: "completed" })))).toEqual(["4"]);
    expect(filterListings(items, q({ status: "all" }))).toHaveLength(4);
  });

  it("카테고리는 정확히 일치", () => {
    expect(regDates(filterListings(items, q({ category: "서버" })))).toEqual(["2"]);
  });

  it("재고는 이상", () => {
    expect(regDates(filterListings(items, q({ minStock: 10 })))).toEqual(["20261001090000", "3"]);
  });

  it("가격은 경계 포함 범위, 한쪽만 있어도 됨", () => {
    expect(regDates(filterListings(items, q({ minPrice: 320, maxPrice: 1_900_000 })))).toEqual(["20261001090000", "3"]);
    expect(regDates(filterListings(items, q({ minPrice: 1_900_001 })))).toEqual(["2"]);
  });

  it("납품일은 그날까지 가능한 것만, 납품일 없는 매물은 제외", () => {
    expect(regDates(filterListings(items, q({ deliveryBy: "2026-10-10" })))).toEqual(["20261001090000"]);
    expect(regDates(filterListings(items, q({ deliveryBy: "2026-12-31" })))).toEqual(["20261001090000", "2"]);
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
