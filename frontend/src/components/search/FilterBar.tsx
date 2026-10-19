"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Icon } from "@/components/common/Icon";
import { FilterCategoryPicker } from "@/components/search/FilterCategoryPicker";
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
const control =
  "h-8.5 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary aria-invalid:border-down";

// 필터는 '적용'을 눌러야 URL에 반영된다. URL이 바뀌면 페이지가 key로 다시 마운트해 칸 값을 URL과 맞춘다
export function FilterBar({ query, scope = "search" }: { query: SearchQuery; scope?: SearchScope }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(query, scope);
  const detailCount = detailFilterCount(query);
  // 상세 필터: 걸린 게 있으면 펼친 채로 연다 (걸려 있는데 안 보이면 왜 결과가 적은지 모른다)
  const [detailOpen, setDetailOpen] = useState(detailCount > 0);
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
  // 상세 칸에 오류가 있으면 접어도 보이게 — 숨은 오류로 [적용]만 꺼져 있으면 이유를 모른다
  const detailError = Boolean(errors.deliveryBy || errors.brand || errors.maxMinOrder);
  const showDetail = detailOpen || detailError;

  const onSubmit = handleSubmit((values) => router.push(buildSearchHref({ ...query, ...values }, scope)));
  const onReset = () => {
    const cleared = clearFilters(query, scope);
    // 필터가 이미 없으면 URL이 그대로라 다시 마운트되지 않으므로 칸도 직접 비운다
    reset(filterDefaults(cleared));
    router.push(buildSearchHref(cleared, scope));
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="search-filter"
        onClick={() => setOpen((v) => !v)}
        className="@md:hidden h-10 px-3 flex items-center gap-2 rounded-md border border-line bg-surface text-sm font-medium text-ink-2"
      >
        <Icon name="filter" size={18} />
        {t.title}
        {count > 0 && <span className="num text-primary">({count})</span>}
      </button>

      <form
        id="search-filter"
        onSubmit={onSubmit}
        noValidate
        className={`${open ? "flex" : "hidden"} @md:flex flex-col @md:flex-row @md:flex-wrap @md:items-start gap-3 @md:gap-x-5 p-3 rounded-md border border-line bg-surface`}
      >
        <Field label={t.status} labelId="f-status">
          <div role="radiogroup" aria-labelledby="f-status" className="flex h-8.5 rounded-md border border-line overflow-hidden">
            {STATUSES.map((s, i) => (
              <label
                key={s}
                className={`px-2.5 flex items-center text-sm text-ink-2 cursor-pointer has-checked:bg-primary-soft has-checked:text-primary-dark has-checked:font-medium has-focus-visible:ring-2 has-focus-visible:ring-primary/40 has-focus-visible:ring-inset ${i > 0 ? "border-l border-line" : ""}`}
              >
                <input type="radio" value={s} {...register("status")} className="sr-only" />
                {t.statuses[s]}
              </label>
            ))}
          </div>
        </Field>

        {/* 카테고리 (2026-10-19 복원 — 마스터 테이블 도입). 대·중에서 멈추면 그 아래 전부 */}
        <Field label={t.category} htmlFor="f-category">
          <FilterCategoryPicker
            id="f-category"
            value={category}
            onChange={(code) => setValue("category", code, { shouldDirty: true, shouldValidate: true })}
          />
        </Field>

        <Field label={t.stock} htmlFor="f-stock" error={errors.minStock?.message} errorId="f-stock-err">
          <input
            id="f-stock"
            inputMode="numeric"
            {...register("minStock")}
            aria-invalid={!!errors.minStock}
            aria-describedby={errors.minStock ? "f-stock-err" : undefined}
            className={`${control} w-24 num text-right`}
          />
          <span className="text-sm text-ink-2">{t.stockSuffix}</span>
        </Field>

        <Field
          label={t.price}
          htmlFor="f-price-min"
          error={errors.minPrice?.message ?? errors.maxPrice?.message}
          errorId="f-price-err"
        >
          <input
            id="f-price-min"
            inputMode="numeric"
            aria-label={t.priceMin}
            // 순서 오류는 최대 가격 칸에 붙으므로, 최소 가격을 고치면 최대 가격도 다시 검사해야 오류가 지워진다
            {...register("minPrice", { deps: "maxPrice" })}
            aria-invalid={!!errors.minPrice}
            aria-describedby={errors.minPrice ? "f-price-err" : undefined}
            className={`${control} w-28 num text-right`}
          />
          <span className="text-sm text-ink-3">~</span>
          <input
            inputMode="numeric"
            aria-label={t.priceMax}
            {...register("maxPrice")}
            aria-invalid={!!errors.maxPrice}
            aria-describedby={errors.maxPrice ? "f-price-err" : undefined}
            className={`${control} w-28 num text-right`}
          />
          <span className="text-sm text-ink-2">{t.won}</span>
        </Field>

        <div className="flex items-center justify-end gap-2 @md:ml-auto">
          <button
            type="button"
            aria-expanded={showDetail}
            aria-controls="search-filter-detail"
            onClick={() => setDetailOpen((v) => !v)}
            className="h-8.5 px-2.5 mr-auto @md:mr-2 flex items-center gap-1 rounded-md border border-line text-sm text-ink-2 hover:text-ink"
          >
            {t.detail}
            {detailCount > 0 && <span className="num text-primary">({detailCount})</span>}
            <span aria-hidden="true" className="text-xs text-ink-3">
              {showDetail ? "▴" : "▾"}
            </span>
          </button>
          <button type="button" onClick={onReset} className="h-8.5 px-2 text-sm text-ink-2 hover:text-ink">
            {t.reset}
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className="h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none"
          >
            {t.apply}
          </button>
        </div>

        {/* 상세 필터 (사용자 지시 2026-10-19: 한 줄에 다 안 들어가 나눔). 접어도 칸은 남겨 둬 입력하던 값이 지워지지 않는다 */}
        <div
          id="search-filter-detail"
          className={`${showDetail ? "flex" : "hidden"} basis-full flex-col @md:flex-row @md:flex-wrap @md:items-start gap-3 @md:gap-x-5 pt-3 border-t border-line-2`}
        >
          <Field label={t.delivery} htmlFor="f-delivery" error={errors.deliveryBy?.message} errorId="f-delivery-err">
            <input
              id="f-delivery"
              type="date"
              {...register("deliveryBy")}
              aria-invalid={!!errors.deliveryBy}
              aria-describedby={errors.deliveryBy ? "f-delivery-err" : undefined}
              className={`${control} num`}
            />
            <span className="text-sm text-ink-2">{t.deliverySuffix}</span>
          </Field>

          <Field label={t.state} htmlFor="f-state">
            <select id="f-state" {...register("state")} className={control}>
              <option value="">{t.stateAny}</option>
              {STATE_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {t.states[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.brand} htmlFor="f-brand" error={errors.brand?.message} errorId="f-brand-err">
            <input
              id="f-brand"
              {...register("brand")}
              placeholder={t.brandPlaceholder}
              aria-invalid={!!errors.brand}
              aria-describedby={errors.brand ? "f-brand-err" : undefined}
              className={`${control} w-36`}
            />
          </Field>

          <Field label={t.warranty} htmlFor="f-warranty">
            <select id="f-warranty" {...register("minWarranty")} className={control}>
              <option value="">{t.warrantyAny}</option>
              {WARRANTY_FILTER_MONTHS.map((m) => (
                <option key={m} value={String(m * 30)}>
                  {t.warrantyAtLeast(m)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.coverage} htmlFor="f-coverage">
            <select id="f-coverage" {...register("coverage")} className={control}>
              <option value="">{t.coverageAny}</option>
              {COVERAGE_FILTERS.map((c) => (
                <option key={c} value={c}>
                  {t.coverages[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.minOrder} htmlFor="f-min-order" error={errors.maxMinOrder?.message} errorId="f-min-order-err">
            <input
              id="f-min-order"
              inputMode="numeric"
              {...register("maxMinOrder")}
              aria-invalid={!!errors.maxMinOrder}
              aria-describedby={errors.maxMinOrder ? "f-min-order-err" : undefined}
              className={`${control} w-20 num text-right`}
            />
            <span className="text-sm text-ink-2">{t.minOrderSuffix}</span>
          </Field>

          <Field label={t.has} labelId="f-has">
            <div role="group" aria-labelledby="f-has" className="flex flex-wrap gap-x-3 gap-y-1.5">
              {HAS_ITEMS.map((h) => (
                <label key={h} className="h-8.5 flex items-center gap-1.5 text-sm text-ink cursor-pointer">
                  <input type="checkbox" value={h} {...register("has")} className="size-4 accent-primary" />
                  {t.hasItems[h]}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  /** 라디오 묶음처럼 label 대상이 하나가 아닐 때 aria-labelledby 용 */
  labelId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}

function Field({ label, htmlFor, labelId, error, errorId, children }: FieldProps) {
  const labelClass = "w-14 @md:w-auto shrink-0 text-[13px] font-medium text-ink-2";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        ) : (
          <span id={labelId} className={labelClass}>
            {label}
          </span>
        )}
        {children}
      </div>
      {error && (
        <p id={errorId} className="pl-15.5 @md:pl-0 text-xs text-down">
          {error}
        </p>
      )}
    </div>
  );
}
