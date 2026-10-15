import { describe, expect, it } from "vitest";
import { buildCategoryOptions, filterCategoryOptions } from "./categories";
import type { CategoryItem } from "@/types/listing";

const item = (categoryCode: string, categoryName: string, categoryClass: string, categoryDepth = "기업용"): CategoryItem => ({
  categoryCode,
  categoryName,
  categoryDepth,
  categoryClass,
  parentCode: null,
});

const items = [
  item("E01", "기업용 컴퓨터", "대"),
  item("E01-F01", "데스크톱", "중"),
  item("E01-F01-G001", "사무용 PC", "소"),
  item("E01-F01-G002", "미니 PC", "소"),
  item("P01", "PC 부품", "대", "개인/사무용"),
  item("P01-Q01", "CPU/프로세서", "중", "개인/사무용"),
  item("P01-Q01-R001", "인텔 CPU", "소", "개인/사무용"),
];

describe("buildCategoryOptions", () => {
  it("소분류만, 코드 앞부분으로 부모를 찾아 '대 > 중 > 소' 경로를 만든다", () => {
    expect(buildCategoryOptions(items)).toEqual([
      { code: "E01-F01-G001", path: "기업용 컴퓨터 > 데스크톱 > 사무용 PC", depth: "기업용" },
      { code: "E01-F01-G002", path: "기업용 컴퓨터 > 데스크톱 > 미니 PC", depth: "기업용" },
      { code: "P01-Q01-R001", path: "PC 부품 > CPU/프로세서 > 인텔 CPU", depth: "개인/사무용" },
    ]);
  });

  it("부모 행이 목록에 없으면 있는 이름만 잇는다", () => {
    expect(buildCategoryOptions([item("E01-F01-G001", "사무용 PC", "소")])[0]?.path).toBe("사무용 PC");
  });
});

describe("filterCategoryOptions", () => {
  const options = buildCategoryOptions(items);

  it("빈 검색어는 앞에서 limit 개", () => {
    expect(filterCategoryOptions(options, "  ", 2)).toHaveLength(2);
  });

  it("띄어쓰기로 나눈 낱말이 모두 들어간 것만, 대소문자 무시", () => {
    expect(filterCategoryOptions(options, "pc 미니").map((o) => o.code)).toEqual(["E01-F01-G002"]);
    expect(filterCategoryOptions(options, "cpu").map((o) => o.code)).toEqual(["P01-Q01-R001"]);
  });

  it("구분(개인/사무용)으로도 찾고, 맞는 게 없으면 빈 목록", () => {
    expect(filterCategoryOptions(options, "개인").map((o) => o.code)).toEqual(["P01-Q01-R001"]);
    expect(filterCategoryOptions(options, "없는분류")).toEqual([]);
  });
});
