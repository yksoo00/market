"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Icon } from "@/components/common/Icon";
import { categoryLabel, FilterCategoryPanel, useCategoryTree } from "@/components/search/FilterCategoryPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPrice } from "@/lib/format";
import {
  activeFilterCount,
  buildSearchHref,
  clearFilters,
  COVERAGE_FILTERS,
  detailFilterCount,
  HAS_ITEMS,
  STATE_FILTERS,
  WARRANTY_FILTER_MONTHS,
  type SearchQuery,
  type SearchScope,
} from "@/lib/search";
import {
  filterDefaults,
  searchFilterSchema,
  type SearchFilterInput,
  type SearchFilterOutput,
} from "@/lib/validation/searchFilter";
import { search } from "@/messages/search";

const t = search.filter;
const STATUSES = ["available", "completed", "all"] as const;
const inputClass =
  "h-8.5 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary aria-invalid:border-down";
const applyClass =
  "h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none";

type PopId = "status" | "category" | "stock" | "price" | "detail";

/**
 * 필터 칩 툴바 (사용자 지시 2026-10-19: 상자 + 칸 나열은 빈칸이 많고 [적용]이 칸 사이에 섞여 어색했다).
 * 칩을 누르면 팝업에서 고른다. 고르기만 하는 칸(거래상태·소분류)은 바로, 입력 칸은 팝업의 [적용]을 눌러야 URL 에 반영된다.
 * 팝업을 열 때 칸을 URL 값으로 되돌린다 — 적용 안 하고 닫은 입력이 다른 팝업의 [적용]에 섞여 들어가지 않게.
 * URL 이 바뀌면 페이지가 key 로 다시 마운트해 칩·칸이 URL 과 맞는다.
 */
export function FilterBar({ query, scope = "search" }: { query: SearchQuery; scope?: SearchScope }) {
  const router = useRouter();
  const tree = useCategoryTree();
  const [openId, setOpenId] = useState<PopId | null>(null);
  const base = clearFilters(query, scope);
  const count = activeFilterCount(query, scope);
  const detailCount = detailFilterCount(query);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control: formControl,
    formState: { errors, isValid },
  } = useForm<SearchFilterInput, unknown, SearchFilterOutput>({
    resolver: zodResolver(searchFilterSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: filterDefaults(query),
  });
  const category = useWatch({ control: formControl, name: "category" });

  const go = (next: SearchQuery) => {
    setOpenId(null);
    router.push(buildSearchHref(next, scope));
  };
  const apply = handleSubmit((values) => go({ ...query, ...values }));
  const popup = (id: PopId) => ({
    open: openId === id,
    onOpenChange: (open: boolean) => {
      if (open) reset(filterDefaults(query));
      setOpenId(open ? id : null);
    },
  });

  const priceLabel =
    query.minPrice === undefined && query.maxPrice === undefined
      ? t.price
      : t.priceChip(query.minPrice === undefined ? "" : formatPrice(query.minPrice), query.maxPrice === undefined ? "" : formatPrice(query.maxPrice));

  return (
    // 좁은 칸·모바일은 한 줄 가로 스크롤 (칩이 줄바꿈되면 결과가 밀린다)
    <div role="toolbar" aria-label={t.title} className="flex items-center gap-2 overflow-x-auto @md:flex-wrap @md:overflow-visible pb-0.5">
      <Chip
        label={t.statuses[query.status]}
        active={query.status !== base.status}
        onClear={() => go({ ...query, status: base.status })}
        clearLabel={t.clear(t.status)}
        {...popup("status")}
      >
        <div role="group" aria-label={t.status} className="flex flex-col min-w-36">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={query.status === s}
              onClick={() => go({ ...query, status: s })}
              className={`h-9 px-3 rounded-md text-left text-sm hover:bg-bg ${query.status === s ? "text-primary font-medium" : "text-ink"}`}
            >
              {t.statuses[s]}
            </button>
          ))}
        </div>
      </Chip>

      {/* 카테고리 (2026-10-19 복원). 대·중에서 멈추면 [적용], 소분류는 누르면 바로 */}
      <Chip
        label={query.category ? t.categoryChip(categoryLabel(tree, query.category)) : t.category}
        active={query.category !== ""}
        onClear={() => go({ ...query, category: "" })}
        clearLabel={t.clear(t.category)}
        contentClass="w-[36rem]"
        {...popup("category")}
      >
        {Array.isArray(tree) ? (
          <div className="flex flex-col gap-2">
            <FilterCategoryPanel
              tree={tree}
              value={category}
              onChange={(code) => setValue("category", code)}
              onPickSmall={(code) => go({ ...query, category: code })}
            />
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => go({ ...query, category: "" })} className="h-8.5 px-2 text-sm text-ink-2 hover:text-ink">
                {t.categoryClear}
              </button>
              <button type="button" onClick={() => go({ ...query, category })} className={applyClass}>
                {t.apply}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">{tree === "failed" ? t.categoryLoadFailed : t.categoryLoading}</p>
        )}
      </Chip>

      <Chip
        label={query.minStock === undefined ? t.stock : t.stockChip(query.minStock)}
        active={query.minStock !== undefined}
        onClear={() => go({ ...query, minStock: undefined })}
        clearLabel={t.clear(t.stock)}
        {...popup("stock")}
      >
        <PopForm onSubmit={apply} valid={isValid}>
          <PopField label={t.stock} htmlFor="f-stock" error={errors.minStock?.message} errorId="f-stock-err">
            <input
              id="f-stock"
              inputMode="numeric"
              autoFocus
              {...register("minStock")}
              aria-invalid={!!errors.minStock}
              aria-describedby={errors.minStock ? "f-stock-err" : undefined}
              className={`${inputClass} w-28 num text-right`}
            />
            <span className="text-sm text-ink-2">{t.stockSuffix}</span>
          </PopField>
        </PopForm>
      </Chip>

      <Chip
        label={priceLabel}
        active={query.minPrice !== undefined || query.maxPrice !== undefined}
        onClear={() => go({ ...query, minPrice: undefined, maxPrice: undefined })}
        clearLabel={t.clear(t.price)}
        {...popup("price")}
      >
        <PopForm onSubmit={apply} valid={isValid}>
          <PopField label={t.price} htmlFor="f-price-min" error={errors.minPrice?.message ?? errors.maxPrice?.message} errorId="f-price-err">
            <input
              id="f-price-min"
              inputMode="numeric"
              autoFocus
              aria-label={t.priceMin}
              // 순서 오류는 최대 가격 칸에 붙으므로, 최소 가격을 고치면 최대 가격도 다시 검사해야 오류가 지워진다
              {...register("minPrice", { deps: "maxPrice" })}
              aria-invalid={!!errors.minPrice}
              aria-describedby={errors.minPrice ? "f-price-err" : undefined}
              className={`${inputClass} w-28 num text-right`}
            />
            <span className="text-sm text-ink-3">~</span>
            <input
              inputMode="numeric"
              aria-label={t.priceMax}
              {...register("maxPrice")}
              aria-invalid={!!errors.maxPrice}
              aria-describedby={errors.maxPrice ? "f-price-err" : undefined}
              className={`${inputClass} w-28 num text-right`}
            />
            <span className="text-sm text-ink-2">{t.won}</span>
          </PopField>
        </PopForm>
      </Chip>

      {/* 상세 필터 (사용자 지시 2026-10-19). 칸이 많아 한 팝업에 모으고 [적용] 한 번 */}
      <Chip
        label={detailCount > 0 ? t.detailChip(detailCount) : t.detail}
        active={detailCount > 0}
        onClear={() =>
          go({ ...query, deliveryBy: undefined, state: undefined, brand: undefined, minWarranty: undefined, coverage: undefined, has: [], maxMinOrder: undefined })
        }
        clearLabel={t.clear(t.detail)}
        align="end"
        contentClass="w-[34rem]"
        {...popup("detail")}
      >
        <PopForm onSubmit={apply} valid={isValid}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
            <PopField label={t.delivery} htmlFor="f-delivery" error={errors.deliveryBy?.message} errorId="f-delivery-err">
              <input
                id="f-delivery"
                type="date"
                {...register("deliveryBy")}
                aria-invalid={!!errors.deliveryBy}
                aria-describedby={errors.deliveryBy ? "f-delivery-err" : undefined}
                className={`${inputClass} num`}
              />
              <span className="text-sm text-ink-2">{t.deliverySuffix}</span>
            </PopField>

            <PopField label={t.state} htmlFor="f-state">
              <select id="f-state" {...register("state")} className={inputClass}>
                <option value="">{t.stateAny}</option>
                {STATE_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {t.states[s]}
                  </option>
                ))}
              </select>
            </PopField>

            <PopField label={t.brand} htmlFor="f-brand" error={errors.brand?.message} errorId="f-brand-err">
              <input
                id="f-brand"
                {...register("brand")}
                placeholder={t.brandPlaceholder}
                aria-invalid={!!errors.brand}
                aria-describedby={errors.brand ? "f-brand-err" : undefined}
                className={`${inputClass} w-40`}
              />
            </PopField>

            <PopField label={t.warranty} htmlFor="f-warranty">
              <select id="f-warranty" {...register("minWarranty")} className={inputClass}>
                <option value="">{t.warrantyAny}</option>
                {WARRANTY_FILTER_MONTHS.map((m) => (
                  <option key={m} value={String(m * 30)}>
                    {t.warrantyAtLeast(m)}
                  </option>
                ))}
              </select>
            </PopField>

            <PopField label={t.coverage} htmlFor="f-coverage">
              <select id="f-coverage" {...register("coverage")} className={inputClass}>
                <option value="">{t.coverageAny}</option>
                {COVERAGE_FILTERS.map((c) => (
                  <option key={c} value={c}>
                    {t.coverages[c]}
                  </option>
                ))}
              </select>
            </PopField>

            <PopField label={t.minOrder} htmlFor="f-min-order" error={errors.maxMinOrder?.message} errorId="f-min-order-err">
              <input
                id="f-min-order"
                inputMode="numeric"
                {...register("maxMinOrder")}
                aria-invalid={!!errors.maxMinOrder}
                aria-describedby={errors.maxMinOrder ? "f-min-order-err" : undefined}
                className={`${inputClass} w-20 num text-right`}
              />
              <span className="text-sm text-ink-2">{t.minOrderSuffix}</span>
            </PopField>

            <div className="sm:col-span-2">
              <PopField label={t.has} labelId="f-has">
                <div role="group" aria-labelledby="f-has" className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {HAS_ITEMS.map((h) => (
                    <label key={h} className="h-8 flex items-center gap-1.5 text-sm text-ink cursor-pointer">
                      <input type="checkbox" value={h} {...register("has")} className="size-4 accent-primary" />
                      {t.hasItems[h]}
                    </label>
                  ))}
                </div>
              </PopField>
            </div>
          </div>
        </PopForm>
      </Chip>

      {count > 0 && (
        <button type="button" onClick={() => go(base)} className="shrink-0 h-8.5 px-2 text-sm text-ink-2 hover:text-ink">
          {t.reset}
        </button>
      )}
    </div>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  clearLabel: string;
  align?: "start" | "end";
  contentClass?: string;
  children: ReactNode;
}

/** 칩 = 팝업 여는 버튼 + (걸려 있으면) 그 조건만 지우는 × */
function Chip({ label, active, open, onOpenChange, onClear, clearLabel, align, contentClass, children }: ChipProps) {
  return (
    <div
      className={`shrink-0 h-8.5 flex items-center rounded-full border text-sm ${
        active ? "border-primary bg-primary-soft text-primary-dark font-medium" : "border-line bg-surface text-ink-2"
      }`}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger className={`h-full ${active ? "pl-3.5 pr-1.5" : "px-3.5"} flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}>
          <span className="max-w-48 truncate">{label}</span>
          <span aria-hidden="true" className="text-xs opacity-60">
            ▾
          </span>
        </PopoverTrigger>
        <PopoverContent align={align} className={contentClass}>
          {children}
        </PopoverContent>
      </Popover>
      {active && (
        <button type="button" aria-label={clearLabel} onClick={onClear} className="h-full pl-1 pr-2.5 flex items-center rounded-r-full hover:text-primary">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

function PopForm({ onSubmit, valid, children }: { onSubmit: () => void; valid: boolean; children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3"
    >
      {children}
      <div className="flex justify-end">
        <button type="submit" disabled={!valid} className={applyClass}>
          {t.apply}
        </button>
      </div>
    </form>
  );
}

interface PopFieldProps {
  label: string;
  htmlFor?: string;
  /** 체크박스 묶음처럼 label 대상이 하나가 아닐 때 aria-labelledby 용 */
  labelId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}

function PopField({ label, htmlFor, labelId, error, errorId, children }: PopFieldProps) {
  const labelClass = "text-[13px] font-medium text-ink-2";
  return (
    <div className="flex flex-col gap-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span id={labelId} className={labelClass}>
          {label}
        </span>
      )}
      <div className="flex items-center gap-1.5">{children}</div>
      {error && (
        <p id={errorId} className="text-xs text-down">
          {error}
        </p>
      )}
    </div>
  );
}
