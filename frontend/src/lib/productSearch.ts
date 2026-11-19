// 상품마스터 큰 검색 모달의 조건·페이지 계산 (계획 2026-11-09-product-search-modal.md). 서버는 GET /api/v1/products/page 로 조건과 페이지 번호를 받는다.

export interface ProductFilter {
  /** 이름·제조사·상품번호·분류번호 부분일치 */
  q: string;
  /** 대 / 대-중 / 대-중-소 경로 코드 ("" = 전체) */
  category: string;
  /** 제조사 부분일치 */
  brand: string;
  /** 1부터 */
  page: number;
}

export const initialProductFilter: ProductFilter = { q: "", category: "", brand: "", page: 1 };

/** 쿼리 문자열. 빈 조건은 빼고(서버는 빈 값을 "조건 없음"으로 본다) page 는 늘 넣는다 */
export function buildProductSearchParams(f: ProductFilter): string {
  const params = new URLSearchParams();
  if (f.q.trim() !== "") params.set("q", f.q.trim());
  if (f.category.trim() !== "") params.set("category", f.category.trim());
  if (f.brand.trim() !== "") params.set("brand", f.brand.trim());
  params.set("page", String(f.page));
  return params.toString();
}

/** 1 ~ totalPages 안으로. 결과가 비어도 1페이지는 있다 */
export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}

/**
 * 조건을 바꾼 새 조건. 검색어·카테고리·제조사가 실제로 바뀌면 1페이지로 돌아간다(앞서 보던 3페이지가 새 결과엔 없을 수 있어서).
 * page 만 주면 그 페이지로 가고, 값이 그대로면 페이지를 건드리지 않는다
 */
export function applyFilter(current: ProductFilter, patch: Partial<ProductFilter>): ProductFilter {
  const next = { ...current, ...patch };
  const changed = next.q !== current.q || next.category !== current.category || next.brand !== current.brand;
  return changed && patch.page === undefined ? { ...next, page: 1 } : next;
}
