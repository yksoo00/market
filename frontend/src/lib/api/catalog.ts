import { api } from "@/lib/api/client";
import type { CategoryItem, ProductSearchItem } from "@/types/listing";

/** 등록 폼이 쓰는 상품마스터 검색·카테고리 목록 (둘 다 로그인 필요) */
export const catalogApi = {
  searchProducts: (q: string) => api<ProductSearchItem[]>(`/api/v1/products?q=${encodeURIComponent(q)}`, { cache: "no-store" }),
  categories: () => api<CategoryItem[]>("/api/v1/categories", { cache: "no-store" }),
};
