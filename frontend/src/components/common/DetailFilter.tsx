"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { applyClass, Chip, inputClass, PopField, PopForm } from "@/components/common/FilterChip";
import { fieldIsEmpty, fieldKeys, filterCount, type FilterField, type FilterValues } from "@/lib/detailFilter";
import { formatPrice } from "@/lib/format";

export interface DetailFilterLabels {
  /** 검색창(줄 전체)의 접근 가능한 이름 */
  toolbar: string;
  /** 칩 줄의 접근 가능한 이름 */
  filters: string;
  searchPlaceholder: string;
  search: string;
  apply: string;
  /** 줄 옆: 검색어·칩 조건 전부 비운다 */
  reset: string;
  /** 칩 옆 ×: 그 조건만 지운다 */
  clear: (what: string) => string;
}

interface Props {
  labels: DetailFilterLabels;
  /** 검색창이 쓰는 값 키 */
  searchKey: string;
  fields: FilterField[];
  /** 폼 검증. 칸은 문자열 그대로(빈 칸 = 조건 없음)라 출력도 FilterValues */
  schema: z.ZodType;
  /** 지금 걸려 있는 값 (주소에서). 주소가 바뀌면 부모가 key 로 다시 마운트한다 */
  values: FilterValues;
  /** 전부 비운 값 */
  empty: FilterValues;
  onApply: (values: FilterValues) => void;
  /** 서버가 돌려준 필드 오류 (키 = 폼 값 키). 폼 오류가 없을 때만 보인다 */
  serverErrors?: Record<string, string>;
}

/**
 * 검색창 + 필터 칩 줄 (사용자 지시 2026-10-30: 검색 결과 화면과 똑같이). 검색 화면의 FilterBar 와 같은 칩·팝업 부품을 쓰고
 * 화면마다 칸 정의(fields)만 다르다. 고르기만 하는 칸(select)은 누르면 바로, 입력 칸(기간·금액)은 팝업의 [적용]을 눌러야 주소에
 * 반영된다. 팝업을 열 때 칸을 주소 값으로 되돌려, 적용 안 하고 닫은 입력이 다른 팝업의 [적용]에 섞여 들어가지 않게 한다.
 * 주소가 바뀌면 부모가 key 로 다시 마운트해 칩·칸이 주소와 맞는다.
 */
export function DetailFilter({ labels, searchKey, fields, schema, values, empty, onApply, serverErrors }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FilterValues>({
    // 폼 값이 문자열 묶음이라는 약속은 호출하는 쪽 스키마가 지킨다
    resolver: zodResolver(schema as z.ZodType<FilterValues, FilterValues>),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: values,
  });
  const count = filterCount(fields, values);
  const applied = count > 0 || values[searchKey] !== "";
  const errorOf = (key: string) => errors[key]?.message ?? serverErrors?.[key];

  // 검색은 지금 걸린 칩 조건에 검색어만 바꿔서
  const search = handleSubmit((v) => onApply({ ...values, [searchKey]: v[searchKey] ?? "" }));
  // 칩 팝업의 [적용] — 그 칸의 값만 바꾼다
  const applyField = (field: FilterField) =>
    handleSubmit((v) => {
      setOpenId(null);
      onApply({ ...values, ...Object.fromEntries(fieldKeys(field).map((k) => [k, v[k] ?? ""])) });
    });
  const popup = (id: string) => ({
    open: openId === id,
    onOpenChange: (open: boolean) => {
      if (open) reset(values);
      setOpenId(open ? id : null);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <form
        role="search"
        aria-label={labels.toolbar}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void search(e);
        }}
        className="flex flex-col gap-1"
      >
        <div className="flex gap-2">
          <input
            type="search"
            aria-label={labels.toolbar}
            placeholder={labels.searchPlaceholder}
            {...register(searchKey)}
            aria-invalid={!!errorOf(searchKey)}
            aria-describedby={errorOf(searchKey) ? `df-${searchKey}-err` : undefined}
            className={`${inputClass} min-w-0 grow`}
          />
          <button type="submit" disabled={!isValid} className={applyClass}>
            {labels.search}
          </button>
        </div>
        {errorOf(searchKey) && (
          <p id={`df-${searchKey}-err`} className="text-xs text-down">
            {errorOf(searchKey)}
          </p>
        )}
      </form>

      {/* 좁은 칸·모바일은 한 줄 가로 스크롤 (칩이 줄바꿈되면 결과가 밀린다) */}
      <div role="toolbar" aria-label={labels.filters} className="flex items-center gap-2 overflow-x-auto @md:flex-wrap @md:overflow-visible pb-0.5">
        {fields.map((field) => {
          const id = fieldKeys(field)[0];
          const active = !fieldIsEmpty(field, values);
          const common = {
            active,
            clearLabel: labels.clear(field.label),
            // 낮은 칸(3분할 아래 칸)에서도 잘리지 않게 사용 가능한 높이 안에서 스크롤
            contentClass: "max-h-(--radix-popover-content-available-height) overflow-y-auto",
            ...popup(id),
          };
          if (field.kind === "select") {
            const current = values[field.key] ?? field.defaultValue;
            const currentLabel = field.options.find((o) => o.value === current)?.label ?? current;
            return (
              <Chip
                key={id}
                label={active ? `${field.label}: ${currentLabel}` : field.label}
                onClear={() => onApply({ ...values, [field.key]: field.defaultValue })}
                {...common}
              >
                <div role="group" aria-label={field.label} className="flex flex-col min-w-36">
                  {field.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={current === o.value}
                      onClick={() => {
                        setOpenId(null);
                        onApply({ ...values, [field.key]: o.value });
                      }}
                      className={`h-9 px-3 rounded-md text-left text-sm hover:bg-bg ${current === o.value ? "text-primary font-medium" : "text-ink"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Chip>
            );
          }
          const [a, b] = fieldKeys(field);
          const isDate = field.kind === "dateRange";
          const [aLabel, bLabel] = field.kind === "dateRange" ? [field.fromLabel, field.toLabel] : [field.minLabel, field.maxLabel];
          const show = (v: string) => (v === "" ? "" : isDate ? v : formatPrice(Number(v)));
          const suffix = field.kind === "numberRange" ? field.suffix : "";
          const error = errorOf(a) ?? errorOf(b);
          const errorId = `df-${errorOf(a) ? a : b}-err`;
          const input = (key: string, label: string) => (
            <input
              id={`df-${key}`}
              type={isDate ? "date" : "text"}
              inputMode={isDate ? undefined : "numeric"}
              aria-label={label}
              placeholder={isDate ? undefined : label}
              {...register(key)}
              aria-invalid={!!errorOf(key)}
              aria-describedby={error ? errorId : undefined}
              className={`${inputClass} ${isDate ? "" : "w-28 num text-right"}`}
            />
          );
          return (
            <Chip
              key={id}
              label={active ? `${field.label}: ${show(values[a] ?? "")}~${show(values[b] ?? "")}${suffix}` : field.label}
              onClear={() => onApply({ ...values, [a]: "", [b]: "" })}
              {...common}
            >
              <PopForm onSubmit={applyField(field)} valid={isValid} applyLabel={labels.apply}>
                <PopField label={field.label} error={error} errorId={errorId}>
                  {input(a, aLabel)}
                  <span className="text-sm text-ink-2">~</span>
                  {input(b, bLabel)}
                  {suffix && <span className="text-sm text-ink-2">{suffix}</span>}
                </PopField>
              </PopForm>
            </Chip>
          );
        })}

        {applied && (
          <button type="button" onClick={() => onApply(empty)} className="shrink-0 h-8.5 px-2 text-sm text-ink-2 hover:text-ink">
            {labels.reset}
          </button>
        )}
      </div>
    </div>
  );
}
