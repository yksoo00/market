import { api } from "@/lib/api/client";
import type { CategoryItem, ProductSearchItem } from "@/types/listing";

/** 상품마스터 검색(등록 폼, 로그인 필요)·카테고리 목록(등록 폼·검색 필터, 공개) */
export const catalogApi = {
  searchProducts: (q: string) => api<ProductSearchItem[]>(`/api/v1/products?q=${encodeURIComponent(q)}`, { cache: "no-store" }),
  categories: () => api<CategoryItem[]>("/api/v1/categories", { cache: "no-store" }),
};
