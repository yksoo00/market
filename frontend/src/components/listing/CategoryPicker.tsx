"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
import { FieldShell, statusClass, useFieldStatus } from "@/components/auth/FormField";
import { Input } from "@/components/ui/input";
import { catalogApi } from "@/lib/api/catalog";
import { buildCategoryOptions, filterCategoryOptions, type CategoryOption } from "@/lib/categories";
import type { ListingFormInput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

const t = listing.form;

// 목록(239건)은 모든 사용자가 같아 화면을 다시 열어도 한 번만 받는다. 실패하면 비워 다음에 다시 받는다
let optionsCache: Promise<CategoryOption[] | null> | null = null;
function loadOptions(): Promise<CategoryOption[] | null> {
  optionsCache ??= catalogApi.categories().then((r) => {
    if (r.ok) return buildCategoryOptions(r.data);
    optionsCache = null;
    return null;
  });
  return optionsCache;
}

/**
 * 카테고리 검색 목록 (콤보박스). 소분류만 보이고 "대 > 중 > 소" 경로를 보여 주며, 고르면 코드가 폼 칸 categoryCode 로 들어간다.
 * readOnly = 상품마스터를 골라 마스터 값이 채워진 상태 (경로만 보여 준다)
 */
export function CategoryPicker({ readOnly = false }: { readOnly?: boolean }) {
  const { register, setValue, control } = useFormContext<ListingFormInput>();
  const code = useWatch({ control, name: "categoryCode" });
  const { error, valid, touched } = useFieldStatus<ListingFormInput>("categoryCode");
  const [options, setOptions] = useState<CategoryOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    let live = true;
    void loadOptions().then((loaded) => {
      if (!live) return;
      if (loaded) setOptions(loaded);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const matches = useMemo(() => (options ? filterCategoryOptions(options, query) : []), [options, query]);
  const selected = options?.find((o) => o.code === code);
  // 열려 있으면 검색어, 닫혀 있으면 고른 분류의 경로(목록 전이면 코드)
  const shown = open ? query : (selected?.path ?? code);

  const choose = (option: CategoryOption) => {
    setValue("categoryCode", option.code, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    // 아무것도 안 고르고 벗어나도 필수 오류가 보이게 touched 로
    setValue("categoryCode", code, { shouldValidate: true, shouldTouch: true });
  };

  const status = failed ? t.categoryLoadFailed : options === null ? t.categoryLoading : undefined;

  return (
    <FieldShell inline label={t.categoryCode} htmlFor="categoryPicker" error={error} note={status ? <span className="text-ink-3">{status}</span> : undefined}>
      {/* 폼 값은 이 숨은 칸이 들고 있다 (등록·서버 오류 표시용) */}
      <input type="hidden" {...register("categoryCode")} />
      <div className="relative">
        <Input
          id="categoryPicker"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          aria-invalid={touched && Boolean(error)}
          aria-describedby={error ? "categoryPicker-error" : undefined}
          autoComplete="off"
          readOnly={readOnly}
          placeholder={t.categoryPlaceholder}
          value={shown}
          className={cn(statusClass(valid), readOnly && "bg-bg text-ink-2")}
          onFocus={() => {
            if (readOnly) return;
            setQuery("");
            setActive(0);
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => {
            if (!readOnly) close();
          }}
          onKeyDown={(e) => {
            if (readOnly) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open) {
              // 열려 있을 땐 Enter 가 폼 제출이 아니라 고르기
              e.preventDefault();
              const option = matches[active];
              if (option) choose(option);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {open && !readOnly && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-md"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-3">{options === null ? (status ?? t.categoryLoading) : t.categoryNoResult}</li>
            ) : (
              matches.map((o, i) => (
                <li
                  key={o.code}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.code === code}
                  // mousedown 에서 막아야 입력의 blur 가 먼저 목록을 닫지 않는다
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex items-baseline gap-2 px-3 py-2 text-sm cursor-pointer", i === active && "bg-primary-soft")}
                >
                  <span className="shrink-0 text-xs text-ink-3">{o.depth}</span>
                  <span className="min-w-0 break-words text-ink">{o.path}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </FieldShell>
  );
}
