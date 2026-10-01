import { z } from "zod";
import { isValidDate, MAX_PRICE, MAX_STOCK, type SearchQuery } from "@/lib/search";
import { search as t } from "@/messages/search";

// 검색 결과 필터 바. 수치는 docs/security.md "입력 검증"이 원본.
// 칸은 문자열로 받고 빈 칸은 "조건 없음"(undefined). 출력 키는 SearchQuery의 필터 키와 같아 그대로 합칠 수 있다.

const optionalInt = (max: number, message: string) =>
  z
    .string()
    .refine((s) => s === "" || (/^\d+$/.test(s) && Number(s) <= max), message)
    .transform((s) => (s === "" ? undefined : Number(s)));

export const searchFilterSchema = z
  .object({
    category: z.string(),
    status: z.enum(["available", "completed", "all"]),
    minStock: optionalInt(MAX_STOCK, t.validation.stock),
    minPrice: optionalInt(MAX_PRICE, t.validation.price),
    maxPrice: optionalInt(MAX_PRICE, t.validation.price),
    deliveryBy: z
      .string()
      .refine((s) => s === "" || isValidDate(s), t.validation.date)
      .transform((s) => (s === "" ? undefined : s)),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: t.validation.priceOrder,
    path: ["maxPrice"],
  });

export type SearchFilterInput = z.input<typeof searchFilterSchema>;
export type SearchFilterOutput = z.output<typeof searchFilterSchema>;

export function filterDefaults(query: SearchQuery): SearchFilterInput {
  const str = (n: number | undefined) => (n === undefined ? "" : String(n));
  return {
    category: query.category,
    status: query.status,
    minStock: str(query.minStock),
    minPrice: str(query.minPrice),
    maxPrice: str(query.maxPrice),
    deliveryBy: query.deliveryBy ?? "",
  };
}
