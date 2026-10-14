"use client";

import { useEffect, useId, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldShell } from "@/components/auth/FormField";
import { catalogApi } from "@/lib/api/catalog";
import type { ListingFormInput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";
import type { ProductSearchItem } from "@/types/listing";

const t = listing.form.master;

/** 마스터의 yyyyMMdd → 날짜 칸의 YYYY-MM-DD. 형식이 다르면 비운다 */
function toDateInput(s: string | null): string {
  return s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : "";
}

// 마스터가 채우는(직접 입력으로 바꾸면 비우는) 폼 칸
const productFields = ["prodId", "masterPhoto", "masterDataSheet", "categoryCode", "prodName", "prodBrand", "prodNo", "prodMufcDate", "prodSpecInfo"] as const;
type ProductField = (typeof productFields)[number];

type Search = { q: string; items: ProductSearchItem[] | null };

/**
 * 상품마스터 드롭다운 (카테고리 칸과 같은 모양). 누르면 목록이 열리고, 이름·제조사·번호를 치면 걸러진다.
 * 고르면 상품 칸(카테고리·상품명·제조사·번호·제조일·사양)이 마스터 값으로 채워지고(읽기 전용), 마스터의 데이터시트·사진 키는 폼에 따로 담긴다.
 * [직접 입력으로 바꾸기]를 누르면 비워져 직접 입력. 마스터에 없으면 그냥 아래 칸에 직접 입력하면 서버가 새 마스터로 저장한다.
 */
export function ProductPicker() {
  const { setValue, control } = useFormContext<ListingFormInput>();
  const prodId = useWatch({ control, name: "prodId" });
  const name = useWatch({ control, name: "prodName" });
  const brand = useWatch({ control, name: "prodBrand" });
  const prodNo = useWatch({ control, name: "prodNo" });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // items null = 불러오지 못함. q 가 지금 검색어와 같을 때만 보여 준다 (늦게 온 이전 검색어 결과 무시)
  const [search, setSearch] = useState<Search | null>(null);
  const listId = useId();
  const q = query.trim();

  useEffect(() => {
    if (!open) return;
    let live = true;
    // 입력이 멈춘 뒤에 묻는다 (키 입력마다 요청하지 않게). 빈 검색어(열자마자)는 바로
    const timer = setTimeout(() => {
      void catalogApi.searchProducts(q).then((r) => {
        if (live) setSearch({ q, items: r.ok ? r.data : null });
      });
    }, q === "" ? 0 : 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, open]);

  const set = (field: ProductField, value: string) => setValue(field, value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });

  const pick = (p: ProductSearchItem) => {
    set("prodId", p.prodId);
    set("masterPhoto", p.prodPhoto1 ?? "");
    set("masterDataSheet", p.prodDataSheet ?? "");
    set("categoryCode", p.categoryCode);
    set("prodName", p.prodName);
    set("prodBrand", p.prodBrand);
    set("prodNo", p.prodNo ?? "");
    set("prodMufcDate", toDateInput(p.prodMufcDate));
    set("prodSpecInfo", p.prodSpecInfo ?? "");
    setOpen(false);
  };

  const switchToManual = () => {
    for (const field of productFields) set(field, "");
  };

  const result = search && search.q === q ? search : null;
  const items = result?.items ?? [];
  const selectedLabel = prodId !== "" ? [name, brand, prodNo].filter(Boolean).join(" · ") : "";
  const status = result === null ? t.searching : result.items === null ? t.failed : result.items.length === 0 ? t.noResult : null;

  return (
    <FieldShell inline label={t.label} htmlFor="productPicker" note={<span className="text-ink-3">{t.hint}</span>}>
      <div className="flex gap-2">
        <div className="relative grow min-w-0">
          <Input
            id="productPicker"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            maxLength={50}
            placeholder={t.placeholder}
            // 열려 있으면 검색어, 닫혀 있으면 고른 상품
            value={open ? query : selectedLabel}
            className={cn("h-11 px-3 text-[15px] bg-surface", prodId !== "" && !open && "border-primary bg-primary-soft")}
            onFocus={() => {
              setQuery("");
              setActive(0);
              setOpen(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                // 등록 폼이 제출되지 않게. 열려 있으면 고르기
                e.preventDefault();
                const item = open ? items[active] : undefined;
                if (item) pick(item);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {open && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-md"
            >
              {status !== null ? (
                <li role="presentation" className={cn("px-3 py-2 text-sm", result?.items === null ? "text-down" : "text-ink-3")}>
                  {status}
                </li>
              ) : (
                items.map((p, i) => (
                  <li
                    key={p.prodId}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={p.prodId === prodId}
                    // mousedown 에서 막아야 입력의 blur 가 먼저 목록을 닫지 않는다
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn("px-3 py-2 cursor-pointer", i === active && "bg-primary-soft")}
                  >
                    <span className="block text-[15px] font-semibold text-ink break-words">{p.prodName}</span>
                    <span className="block text-xs text-ink-2 break-words">
                      {p.prodBrand}
                      {p.prodNo && <span className="num"> · {p.prodNo}</span>}
                      {p.categoryName && <span> · {p.categoryName}</span>}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {prodId !== "" && (
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={switchToManual}>
            {t.switchToManual}
          </Button>
        )}
      </div>
    </FieldShell>
  );
}
