"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import type { z } from "zod";
import { applyClass, Chip, inputClass, PopField, PopForm } from "@/components/common/FilterChip";
import {
  fieldIsEmpty,
  fieldKeys,
  filterCount,
  groupCount,
  type FilterField,
  type FilterValues,
  type GroupItem,
} from "@/lib/detailFilter";
import { formatPrice } from "@/lib/format";

export interface DetailFilterLabels {
  /** 칩 줄의 접근 가능한 이름 */
  filters: string;
  apply: string;
  /** 줄 옆: 검색어·칩 조건 전부 비운다 */
  reset: string;
  /** 칩 옆 ×: 그 조건만 지운다 */
  clear: (what: string) => string;
  /** 검색창(searchKey 가 있을 때만) — 줄 전체의 접근 가능한 이름·안내 글·[검색] 버튼 */
  toolbar?: string;
  searchPlaceholder?: string;
  search?: string;
}

interface Props {
  labels: DetailFilterLabels;
  /** 검색창이 쓰는 값 키. 없으면 검색창 없이 칩 줄만 (검색 결과 화면은 자기 검색창이 따로 있다) */
  searchKey?: string;
  fields: FilterField[];
  /** 폼 검증. 칸은 문자열 그대로(빈 칸 = 조건 없음). 통과한 값은 쓰지 않고 입력한 문자열 그대로 onApply 로 넘긴다 */
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
 * 검색창 + 필터 칩 줄 (사용자 지시 2026-10-30: 검색 결과 화면과 똑같이 — 검색·거래이력·활동내역이 이 부품 하나를 쓴다).
 * 고르기만 하는 칸(select)은 누르면 바로, 입력 칸은 팝업의 [적용]을 눌러야 주소에 반영된다.
 * 팝업을 열 때 칸을 주소 값으로 되돌려, 적용 안 하고 닫은 입력이 다른 팝업의 [적용]에 섞여 들어가지 않게 한다.
 * 주소가 바뀌면 부모가 key 로 다시 마운트해 칩·칸이 주소와 맞는다. 화면마다 다른 건 칸 정의(fields)뿐이다.
 */
export function DetailFilter({ labels, searchKey, fields, schema, values, empty, onApply, serverErrors }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<FilterValues>({
    // 폼 값이 문자열 묶음이라는 약속은 호출하는 쪽 스키마가 지킨다
    resolver: zodResolver(schema as z.ZodType<FilterValues, FilterValues>),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: values,
  });
  const count = filterCount(fields, values);
  const applied = count > 0 || (searchKey !== undefined && values[searchKey] !== "");
  const errorOf = (key: string) => errors[key]?.message ?? serverErrors?.[key];

  // 검색은 지금 걸린 칩 조건에 검색어만 바꿔서
  const search = handleSubmit(() => onApply({ ...values, [searchKey ?? ""]: getValues(searchKey ?? "") ?? "" }));
  // 칩 팝업의 [적용] — 그 칸의 값만 바꾼다
  const applyField = (field: FilterField) =>
    handleSubmit(() => {
      setOpenId(null);
      onApply({ ...values, ...Object.fromEntries(fieldKeys(field).map((k) => [k, getValues(k) ?? ""])) });
    });
  const popup = (id: string) => ({
    open: openId === id,
    onOpenChange: (open: boolean) => {
      if (open) reset(values);
      setOpenId(open ? id : null);
    },
  });
  const clearField = (field: FilterField): FilterValues => ({
    ...values,
    ...Object.fromEntries(fieldKeys(field).map((k) => [k, field.kind === "select" ? field.defaultValue : ""])),
  });

  return (
    <div className="flex flex-col gap-2">
      {searchKey !== undefined && (
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
      )}

      {/* 좁은 칸·모바일은 한 줄 가로 스크롤 (칩이 줄바꿈되면 결과가 밀린다) */}
      <div role="toolbar" aria-label={labels.filters} className="flex items-center gap-2 overflow-x-auto @md:flex-wrap @md:overflow-visible pb-0.5">
        {fields.map((field) => {
          const id = fieldKeys(field)[0];
          const active = !fieldIsEmpty(field, values);
          const chip = {
            active,
            clearLabel: labels.clear(field.label),
            // 낮은 칸(3분할 아래 칸)에서도 잘리지 않게 사용 가능한 높이 안에서 스크롤
            contentClass: `${field.width ?? ""} max-h-(--radix-popover-content-available-height) overflow-y-auto`.trim(),
            onClear: () => onApply(clearField(field)),
            ...popup(id),
          };
          const text = (fallback: string) => field.chipText?.(values) ?? fallback;

          if (field.kind === "select") {
            const current = values[field.key] ?? field.defaultValue;
            const currentLabel = field.options.find((o) => o.value === current)?.label ?? current;
            return (
              <Chip key={id} label={text(active ? `${field.label}: ${currentLabel}` : field.label)} {...chip}>
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

          if (field.kind === "custom") {
            return (
              <Chip key={id} label={text(field.label)} {...chip}>
                {field.render({
                  values,
                  draft: watch(),
                  setDraft: (key, value) => setValue(key, value, { shouldDirty: true }),
                  applyNow: (next) => {
                    setOpenId(null);
                    onApply(next);
                  },
                })}
              </Chip>
            );
          }

          if (field.kind === "group") {
            const n = groupCount(field, values);
            return (
              <Chip key={id} label={text(n > 0 ? `${field.label} ${n}` : field.label)} align="end" {...chip}>
                <PopForm onSubmit={applyField(field)} valid={isValid} applyLabel={labels.apply}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                    {field.items.map((item) => (
                      <GroupInput key={item.key} item={item} register={register} error={errorOf(item.key)} watch={watch} setValue={setValue} />
                    ))}
                  </div>
                </PopForm>
              </Chip>
            );
          }

          if (field.kind === "numberMin") {
            const error = errorOf(field.key);
            return (
              <Chip key={id} label={text(active ? `${field.label}: ${values[field.key]}${field.suffix}` : field.label)} {...chip}>
                <PopForm onSubmit={applyField(field)} valid={isValid} applyLabel={labels.apply}>
                  <PopField label={field.label} htmlFor={`df-${field.key}`} error={error} errorId={`df-${field.key}-err`}>
                    <input
                      id={`df-${field.key}`}
                      inputMode="numeric"
                      autoFocus
                      {...register(field.key)}
                      aria-invalid={!!error}
                      aria-describedby={error ? `df-${field.key}-err` : undefined}
                      className={`${inputClass} w-28 num text-right`}
                    />
                    <span className="text-sm text-ink-2">{field.suffix}</span>
                  </PopField>
                </PopForm>
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
          const input = (key: string, label: string, first: boolean) => (
            <input
              id={`df-${key}`}
              type={isDate ? "date" : "text"}
              inputMode={isDate ? undefined : "numeric"}
              autoFocus={first && !isDate}
              aria-label={label}
              placeholder={isDate ? undefined : label}
              // 앞 칸을 고치면 뒤 칸도 다시 검사해야 순서 오류가 지워진다 (오류는 뒤 칸에 붙는다)
              {...register(key, first ? { deps: [b] } : undefined)}
              aria-invalid={!!errorOf(key)}
              aria-describedby={error ? errorId : undefined}
              className={`${inputClass} ${isDate ? "" : "w-28 num text-right"}`}
            />
          );
          return (
            <Chip
              key={id}
              label={text(active ? `${field.label}: ${show(values[a] ?? "")}~${show(values[b] ?? "")}${suffix}` : field.label)}
              {...chip}
            >
              <PopForm onSubmit={applyField(field)} valid={isValid} applyLabel={labels.apply}>
                <PopField label={field.label} error={error} errorId={errorId}>
                  {input(a, aLabel, true)}
                  <span className="text-sm text-ink-2">~</span>
                  {input(b, bLabel, false)}
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

/** [상세 필터] 같은 묶음 팝업 안의 칸 하나 */
function GroupInput({
  item,
  register,
  error,
  watch,
  setValue,
}: {
  item: GroupItem;
  register: UseFormRegister<FilterValues>;
  error?: string;
  watch: (key: string) => string;
  setValue: (key: string, value: string, opts?: { shouldDirty?: boolean }) => void;
}) {
  const id = `df-${item.key}`;
  const errId = `${id}-err`;
  const describe = error ? errId : undefined;
  let body: ReactNode;
  if (item.kind === "date") {
    body = (
      <>
        <input id={id} type="date" {...register(item.key)} aria-invalid={!!error} aria-describedby={describe} className={`${inputClass} num`} />
        {item.suffix && <span className="text-sm text-ink-2">{item.suffix}</span>}
      </>
    );
  } else if (item.kind === "select") {
    body = (
      <select id={id} {...register(item.key)} className={inputClass}>
        {item.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (item.kind === "text") {
    body = (
      <input
        id={id}
        {...register(item.key)}
        placeholder={item.placeholder}
        aria-invalid={!!error}
        aria-describedby={describe}
        className={`${inputClass} w-40`}
      />
    );
  } else if (item.kind === "number") {
    body = (
      <>
        <input
          id={id}
          inputMode="numeric"
          {...register(item.key)}
          aria-invalid={!!error}
          aria-describedby={describe}
          className={`${inputClass} w-20 num text-right`}
        />
        {item.suffix && <span className="text-sm text-ink-2">{item.suffix}</span>}
      </>
    );
  } else {
    // 체크박스 묶음 — 값은 쉼표로 이은 문자열 (순서는 options 순서로 맞춘다: 같은 조건이 다른 주소가 되지 않게)
    const picked = new Set((watch(item.key) ?? "").split(",").filter(Boolean));
    return (
      <div className="sm:col-span-2">
        <PopField label={item.label} labelId={id}>
          <div role="group" aria-labelledby={id} className="flex flex-wrap gap-x-3 gap-y-1.5">
            {item.options.map((o) => (
              <label key={o.value} className="h-8 flex items-center gap-1.5 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={picked.has(o.value)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(o.value);
                    else next.delete(o.value);
                    setValue(item.key, item.options.filter((x) => next.has(x.value)).map((x) => x.value).join(","), { shouldDirty: true });
                  }}
                  className="size-4 accent-primary"
                />
                {o.label}
              </label>
            ))}
          </div>
        </PopField>
      </div>
    );
  }
  return (
    <PopField label={item.label} htmlFor={id} error={error} errorId={errId}>
      {body}
    </PopField>
  );
}
