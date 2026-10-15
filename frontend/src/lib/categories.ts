import type { CategoryItem } from "@/types/listing";

/** 등록 폼 카테고리 목록의 한 줄: 소분류 코드, "대 > 중 > 소" 경로 이름, 구분(개인용·기업용·일반) */
export interface CategoryOption {
  code: string;
  path: string;
  depth: string;
}

/**
 * 소분류만 고르는 목록. 경로 이름은 코드 앞부분(`E01`, `E01-F01`)으로 부모를 찾아 만든다 —
 * parentCode 는 엑셀 정의대로 조각(`Q01`)이라 그것만으로는 부모 행을 못 찾는다.
 */
export function buildCategoryOptions(items: CategoryItem[]): CategoryOption[] {
  const names = new Map(items.map((c) => [c.categoryCode, c.categoryName]));
  return items
    .filter((c) => c.categoryClass === "소")
    .map((c) => {
      const parts = c.categoryCode.split("-");
      const path = parts
        .map((_, i) => names.get(parts.slice(0, i + 1).join("-")))
        .filter((n): n is string => Boolean(n))
        .join(" > ");
      return { code: c.categoryCode, path, depth: c.categoryDepth };
    });
}

/** 띄어쓰기로 나눈 낱말이 모두 (구분 + 경로)에 들어 있으면 통과. 대소문자 무시. 빈 검색어는 앞에서 limit 개 */
export function filterCategoryOptions(options: CategoryOption[], query: string, limit = 50): CategoryOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return options.slice(0, limit);
  return options.filter((o) => words.every((w) => `${o.depth} ${o.path}`.toLowerCase().includes(w))).slice(0, limit);
}
