"use client";

import { categoryLabel, FilterCategoryPanel, useCategoryTree } from "@/components/search/FilterCategoryPicker";
import type { CustomContext, FilterField } from "@/lib/detailFilter";
import { formatPrice } from "@/lib/format";
import { COVERAGE_FILTERS, HAS_ITEMS, STATE_FILTERS, WARRANTY_FILTER_MONTHS } from "@/lib/search";
import { search } from "@/messages/search";

const t = search.filter;
const STATUSES = ["available", "completed", "all"] as const;

type Tree = ReturnType<typeof useCategoryTree>;

/** 카테고리 칩의 팝업 (2026-10-19 복원). 대·중에서 멈추면 [적용], 소분류는 누르면 바로 */
function CategoryPopup({ ctx, tree }: { ctx: CustomContext; tree: Tree }) {
  if (!Array.isArray(tree)) {
    return <p className="text-sm text-ink-2">{tree === "failed" ? t.categoryLoadFailed : t.categoryLoading}</p>;
  }
  const category = ctx.draft.category ?? "";
  return (
    <div className="flex flex-col gap-2">
      <FilterCategoryPanel
        tree={tree}
        value={category}
        onChange={(code) => ctx.setDraft("category", code)}
        onPickSmall={(code) => ctx.applyNow({ ...ctx.values, category: code })}
      />
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => ctx.applyNow({ ...ctx.values, category: "" })} className="h-8.5 px-2 text-sm text-ink-2 hover:text-ink">
          {t.categoryClear}
        </button>
        <button
          type="button"
          onClick={() => ctx.applyNow({ ...ctx.values, category })}
          className="h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none"
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
}

/**
 * 검색 결과 화면(전체 검색·내 판매글)의 필터 칸 정의 — 순서·문구·동작은 예전 FilterBar 그대로.
 * defaultStatus 는 범위마다 다르다 (검색 "거래 중", 내 구매 "전체"). tree = 카테고리 트리(칩 글자·팝업이 쓴다)
 */
export function searchFilterFields(defaultStatus: string, tree: Tree): FilterField[] {
  return [
    {
      kind: "select",
      label: t.status,
      key: "status",
      defaultValue: defaultStatus,
      options: STATUSES.map((s) => ({ value: s, label: t.statuses[s] })),
      // 칩에는 고른 값 이름만 (거래 중 / 거래 완료 / 전체)
      chipText: (v) => t.statuses[(v.status as (typeof STATUSES)[number]) ?? "available"] ?? t.status,
    },
    {
      kind: "custom",
      label: t.category,
      keys: ["category"],
      width: "w-[36rem]",
      chipText: (v) => (v.category ? t.categoryChip(categoryLabel(tree, v.category)) : t.category),
      render: (ctx) => <CategoryPopup ctx={ctx} tree={tree} />,
    },
    { kind: "numberMin", label: t.stock, key: "minStock", suffix: t.stockSuffix, chipText: (v) => (v.minStock ? t.stockChip(Number(v.minStock)) : t.stock) },
    {
      kind: "numberRange",
      label: t.price,
      minKey: "minPrice",
      maxKey: "maxPrice",
      minLabel: t.priceMin,
      maxLabel: t.priceMax,
      suffix: t.won,
      chipText: (v) =>
        !v.minPrice && !v.maxPrice ? t.price : t.priceChip(v.minPrice ? formatPrice(Number(v.minPrice)) : "", v.maxPrice ? formatPrice(Number(v.maxPrice)) : ""),
    },
    {
      // 상세 필터 (사용자 지시 2026-10-19). 칸이 많아 한 팝업에 모으고 [적용] 한 번
      kind: "group",
      label: t.detail,
      width: "w-[34rem]",
      chipText: undefined,
      items: [
        { kind: "date", key: "deliveryBy", label: t.delivery, suffix: t.deliverySuffix },
        { kind: "select", key: "state", label: t.state, options: [{ value: "", label: t.stateAny }, ...STATE_FILTERS.map((s) => ({ value: s, label: t.states[s] }))] },
        { kind: "text", key: "brand", label: t.brand, placeholder: t.brandPlaceholder },
        {
          kind: "select",
          key: "minWarranty",
          label: t.warranty,
          options: [{ value: "", label: t.warrantyAny }, ...WARRANTY_FILTER_MONTHS.map((m) => ({ value: String(m * 30), label: t.warrantyAtLeast(m) }))],
        },
        { kind: "select", key: "coverage", label: t.coverage, options: [{ value: "", label: t.coverageAny }, ...COVERAGE_FILTERS.map((c) => ({ value: c, label: t.coverages[c] }))] },
        { kind: "number", key: "maxMinOrder", label: t.minOrder, suffix: t.minOrderSuffix },
        { kind: "check", key: "has", label: t.has, options: HAS_ITEMS.map((h) => ({ value: h, label: t.hasItems[h] })) },
      ],
    },
  ];
}
