import type { CategoryItem } from "@/types/listing";

/** 분류 트리 한 칸. 대분류의 children = 중분류, 중분류의 children = 소분류, 소분류는 빈 배열 */
export interface CategoryNode {
  code: string;
  name: string;
  /** 구분(개인/사무용·기업용·일반) */
  depth: string;
  children: CategoryNode[];
}

/**
 * 대 → 중 → 소 트리. 부모는 코드 앞부분(`E01`, `E01-F01`)으로 찾는다 —
 * parentCode 는 엑셀 정의대로 조각(`Q01`)이라 그것만으로는 부모 행을 못 찾는다.
 * 순서는 받은 목록 순서, 부모가 목록에 없는 행은 뺀다.
 */
export function buildCategoryTree(items: CategoryItem[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    items.map((c) => [c.categoryCode, { code: c.categoryCode, name: c.categoryName, depth: c.categoryDepth, children: [] }]),
  );
  const roots: CategoryNode[] = [];
  for (const c of items) {
    const node = nodes.get(c.categoryCode)!;
    const cut = c.categoryCode.lastIndexOf("-");
    if (cut < 0) roots.push(node);
    else nodes.get(c.categoryCode.slice(0, cut))?.children.push(node);
  }
  return roots;
}

/** 소분류 코드의 "대 > 중 > 소" 경로. 트리에 없으면 null */
export function categoryPath(tree: CategoryNode[], code: string): CategoryNode[] | null {
  const parts = code.split("-");
  const path: CategoryNode[] = [];
  let level = tree;
  for (let i = 0; i < parts.length; i++) {
    const node = level.find((n) => n.code === parts.slice(0, i + 1).join("-"));
    if (!node) return null;
    path.push(node);
    level = node.children;
  }
  return path;
}

/** 대분류를 구분(개인/사무용·기업용·일반)별로 묶는다. 구분 순서는 처음 나온 순서 */
export function groupByDepth(roots: CategoryNode[]): { depth: string; nodes: CategoryNode[] }[] {
  const groups = new Map<string, CategoryNode[]>();
  for (const n of roots) groups.set(n.depth, [...(groups.get(n.depth) ?? []), n]);
  return [...groups].map(([depth, nodes]) => ({ depth, nodes }));
}
