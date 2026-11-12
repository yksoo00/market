import { api } from "@/lib/api/client";
import { buildProductSearchParams, type ProductFilter } from "@/lib/productSearch";
import type { CategoryItem, ProductSearchItem, ProductSearchPage } from "@/types/listing";

/** 상품마스터 검색(등록 폼, 로그인 필요)·카테고리 목록(등록 폼·검색 필터, 공개) */
export const catalogApi = {
  searchProducts: (q: string) => api<ProductSearchItem[]>(`/api/v1/products?q=${encodeURIComponent(q)}`, { cache: "no-store" }),
  /** 큰 검색 모달 — 검색어·카테고리·제조사 필터 + 페이지 번호(크기 20 은 서버가 고정) */
  searchProductsPage: (filter: ProductFilter) =>
    api<ProductSearchPage>(`/api/v1/products/page?${buildProductSearchParams(filter)}`, { cache: "no-store" }),
  categories: () => api<CategoryItem[]>("/api/v1/categories", { cache: "no-store" }),
};
