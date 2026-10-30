"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import type { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fieldKeys, filterCount, type FilterField, type FilterValues } from "@/lib/detailFilter";

export interface DetailFilterLabels {
  /** 줄 전체의 접근 가능한 이름 */
  toolbar: string;
  searchPlaceholder: string;
  search: string;
  detail: string;
  detailChip: (n: number) => string;
  apply: string;
  /** 팝업 안: 상세 칸만 비운다 (검색어는 그대로) */
  resetPopup: string;
  /** 줄 옆: 검색어·상세 전부 비운다 */
  reset: string;
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

const inputClass = "h-8.5 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary aria-invalid:border-down";
const applyClass = "h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none";

/**
 * 검색창 + [상세 필터] 팝업 (사용자 지시 2026-10-30: 칩 여러 개 없이 상세 필터 하나만). 화면마다 칸 정의(fields)만 다르다.
 * 검색은 검색창에서 엔터/[검색], 상세는 팝업의 [적용] — 둘 다 같은 값 묶음을 onApply 로 넘기고 부모가 주소를 바꾼다.
 * 팝업을 열 때 상세 칸을 주소 값으로 되돌려, 적용 안 하고 닫은 입력이 남지 않게 한다 (검색 화면 FilterBar 와 같은 규칙).
 */
export function DetailFilter({ labels, searchKey, fields, schema, values, empty, onApply, serverErrors }: Props) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
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
  const apply = handleSubmit((v) => {
    setOpen(false);
    onApply(v);
  });
  const errorOf = (key: string) => errors[key]?.message ?? serverErrors?.[key];

  return (
    <div role="search" aria-label={labels.toolbar} className="flex flex-wrap items-center gap-2">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void apply(e);
        }}
        className="flex min-w-0 grow basis-56 flex-col gap-1"
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

      <Popover
        open={open}
        onOpenChange={(next) => {
          // 열 때 상세 칸을 주소 값으로 되돌린다. 검색창에 친 글자는 그대로
          if (next) reset({ ...values, [searchKey]: getValues(searchKey) });
          setOpen(next);
        }}
      >
        <PopoverTrigger
          className={`h-8.5 shrink-0 px-3.5 flex items-center gap-1 rounded-md border text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            count > 0 ? "border-primary bg-primary-soft text-primary-dark font-medium" : "border-line bg-surface text-ink-2"
          }`}
        >
          <span>{count > 0 ? labels.detailChip(count) : labels.detail}</span>
          <span aria-hidden="true" className="text-xs opacity-60">
            ▾
          </span>
        </PopoverTrigger>
        {/* 낮은 칸(3분할 아래 칸)에서도 잘리지 않게 사용 가능한 높이 안에서 스크롤 */}
        <PopoverContent align="end" className="w-[26rem] max-h-(--radix-popover-content-available-height) overflow-y-auto">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              // 포털이지만 React 이벤트는 부모 폼으로 번진다 — 검색창 폼이 또 제출되지 않게
              e.stopPropagation();
              void apply(e);
            }}
            className="flex flex-col gap-3"
          >
            {fields.map((f) => (
              <FieldInput key={fieldKeys(f).join("-")} field={f} register={register} errors={errors} serverErrors={serverErrors} />
            ))}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onApply({ ...empty, [searchKey]: values[searchKey] ?? "" });
                }}
                className="h-8.5 px-2 text-sm text-ink-2 hover:text-ink"
              >
                {labels.resetPopup}
              </button>
              <button type="submit" disabled={!isValid} className={applyClass}>
                {labels.apply}
              </button>
            </div>
          </form>
        </PopoverContent>
      </Popover>

      {applied && (
        <button type="button" onClick={() => onApply(empty)} className="shrink-0 h-8.5 px-2 text-sm text-ink-2 hover:text-ink">
          {labels.reset}
        </button>
      )}
    </div>
  );
}

function FieldInput({
  field,
  register,
  errors,
  serverErrors,
}: {
  field: FilterField;
  register: UseFormRegister<FilterValues>;
  errors: FieldErrors<FilterValues>;
  serverErrors?: Record<string, string>;
}) {
  const err = (key: string) => errors[key]?.message ?? serverErrors?.[key];
  const keys = fieldKeys(field);
  const id = (key: string) => `df-${key}`;
  if (field.kind === "select") {
    return (
      <Row label={field.label} htmlFor={id(field.key)} error={err(field.key)} errorId={`${id(field.key)}-err`}>
        <select id={id(field.key)} {...register(field.key)} className={inputClass}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Row>
    );
  }
  const [a, b] = keys;
  const [aLabel, bLabel] = field.kind === "dateRange" ? [field.fromLabel, field.toLabel] : [field.minLabel, field.maxLabel];
  const date = field.kind === "dateRange";
  // 앞·뒤 칸 오류 중 먼저 걸린 하나를 칸 묶음 아래에 보인다
  const error = err(a) ?? err(b);
  const errorKey = err(a) ? a : b;
  const input = (key: string, label: string) => (
    <input
      id={id(key)}
      type={date ? "date" : "text"}
      inputMode={date ? undefined : "numeric"}
      aria-label={label}
      placeholder={date ? undefined : label}
      {...register(key)}
      aria-invalid={!!err(key)}
      aria-describedby={error ? `${id(errorKey)}-err` : undefined}
      className={`${inputClass} min-w-0 grow ${date ? "" : "num text-right"}`}
    />
  );
  return (
    <Row label={field.label} error={error} errorId={`${id(errorKey)}-err`}>
      <div className="flex min-w-0 grow items-center gap-1.5">
        {input(a, aLabel)}
        <span className="text-sm text-ink-2">~</span>
        {input(b, bLabel)}
        {field.kind === "numberRange" && <span className="text-sm text-ink-2">{field.suffix}</span>}
      </div>
    </Row>
  );
}

function Row({ label, htmlFor, error, errorId, children }: { label: string; htmlFor?: string; error?: string; errorId: string; children: ReactNode }) {
  const labelClass = "text-[13px] font-medium text-ink-2";
  return (
    <div className="flex flex-col gap-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
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
