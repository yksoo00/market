import { describe, expect, it } from "vitest";
import { buildCategoryTree, categoryPath, groupByDepth } from "./categories";
import type { CategoryItem } from "@/types/listing";

const item = (categoryCode: string, categoryName: string, categoryClass: string, categoryDepth = "기업용"): CategoryItem => ({
  categoryCode,
  categoryName,
  categoryDepth,
  categoryClass,
  parentCode: null,
});

// API 순서처럼 소분류가 부모보다 먼저 나와도 된다
const items = [
  item("E01-F01-G001", "사무용 PC", "소"),
  item("E01-F01", "데스크톱", "중"),
  item("E01", "기업용 컴퓨터", "대"),
  item("E01-F01-G002", "미니 PC", "소"),
  item("P01", "PC 부품", "대", "개인/사무용"),
  item("P01-Q01", "CPU/프로세서", "중", "개인/사무용"),
  item("P01-Q01-R001", "인텔 CPU", "소", "개인/사무용"),
  item("E02", "서버", "대"),
];

describe("buildCategoryTree", () => {
  it("코드 앞부분으로 부모를 찾아 대 → 중 → 소로 묶는다", () => {
    const tree = buildCategoryTree(items);
    expect(tree.map((n) => n.code)).toEqual(["E01", "P01", "E02"]);
    expect(tree[0].children.map((n) => n.code)).toEqual(["E01-F01"]);
    expect(tree[0].children[0].children.map((n) => n.name)).toEqual(["사무용 PC", "미니 PC"]);
    expect(tree[2].children).toEqual([]);
  });

  it("부모가 목록에 없는 행은 뺀다", () => {
    expect(buildCategoryTree([item("E01-F01-G001", "사무용 PC", "소")])).toEqual([]);
  });
});

describe("categoryPath", () => {
  const tree = buildCategoryTree(items);

  it("소분류 코드의 대·중·소 노드", () => {
    expect(categoryPath(tree, "P01-Q01-R001")?.map((n) => n.name)).toEqual(["PC 부품", "CPU/프로세서", "인텔 CPU"]);
  });

  it("트리에 없는 코드는 null", () => {
    expect(categoryPath(tree, "P01-Q01-R999")).toBeNull();
    expect(categoryPath(tree, "NOPE")).toBeNull();
  });
});

describe("groupByDepth", () => {
  it("대분류를 구분별로, 처음 나온 순서대로 묶는다", () => {
    const groups = groupByDepth(buildCategoryTree(items));
    expect(groups.map((g) => [g.depth, g.nodes.map((n) => n.code)])).toEqual([
      ["기업용", ["E01", "E02"]],
      ["개인/사무용", ["P01"]],
    ]);
  });
});
