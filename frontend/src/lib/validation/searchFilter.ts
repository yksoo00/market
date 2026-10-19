import { z } from "zod";
import {
  COVERAGE_FILTERS,
  HAS_ITEMS,
  isValidDate,
  MAX_BRAND,
  MAX_MIN_ORDER,
  MAX_PRICE,
  MAX_STOCK,
  STATE_FILTERS,
  WARRANTY_FILTER_MONTHS,
  type CoverageFilter,
  type HasItem,
  type SearchQuery,
  type StateFilter,
} from "@/lib/search";
import { search as t } from "@/messages/search";

// 검색 결과 필터 바. 수치는 docs/security.md "입력 검증"이 원본.
// 칸은 문자열로 받고 빈 칸은 "조건 없음"(undefined). 출력 키는 SearchQuery의 필터 키와 같아 그대로 합칠 수 있다.

const optionalInt = (max: number, message: string, min = 0) =>
  z
    .string()
    .refine((s) => s === "" || (/^\d+$/.test(s) && Number(s) >= min && Number(s) <= max), message)
    .transform((s) => (s === "" ? undefined : Number(s)));

/** 고르는 칸(select): 빈 값 = 조건 없음. 목록 밖 값은 화면에서 고를 수 없어 문구 없이 막기만 한다 */
const optionalChoice = <T extends string>(choices: readonly T[]) =>
  z
    .string()
    .refine((s) => s === "" || (choices as readonly string[]).includes(s))
    .transform((s) => (s === "" ? undefined : (s as T)));

const WARRANTY_DAY_CHOICES = WARRANTY_FILTER_MONTHS.map((m) => String(m * 30));

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
    // 상세 필터 (2026-10-19)
    state: optionalChoice<StateFilter>(STATE_FILTERS),
    brand: z
      .string()
      .refine((s) => s.trim().length <= MAX_BRAND, t.validation.brand)
      .transform((s) => s.trim() || undefined),
    minWarranty: optionalChoice(WARRANTY_DAY_CHOICES).transform((s) => (s === undefined ? undefined : Number(s))),
    coverage: optionalChoice<CoverageFilter>(COVERAGE_FILTERS),
    // 체크박스 묶음. 순서는 HAS_ITEMS 로 맞춘다 (같은 조건이 다른 URL 이 되지 않게)
    has: z.array(z.string()).transform((list): HasItem[] => HAS_ITEMS.filter((h) => list.includes(h))),
    maxMinOrder: optionalInt(MAX_MIN_ORDER, t.validation.minOrder, 1),
  })
  // zod 4는 칸 검사가 실패해도 이 refine을 변환 전 문자열로 돌린다 → 둘 다 숫자일 때만 비교
  .refine((v) => typeof v.minPrice !== "number" || typeof v.maxPrice !== "number" || v.minPrice <= v.maxPrice, {
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
    state: query.state ?? "",
    brand: query.brand ?? "",
    minWarranty: str(query.minWarranty),
    coverage: query.coverage ?? "",
    has: [...query.has],
    maxMinOrder: str(query.maxMinOrder),
  };
}
