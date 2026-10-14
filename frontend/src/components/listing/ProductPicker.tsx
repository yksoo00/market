"use client";

import { useEffect, useId, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
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
type ProductField = (typeof productFields)[number] | "manual";

type Search = { q: string; items: ProductSearchItem[] | null };

/**
 * 상품마스터 드롭다운 (카테고리 칸과 같은 모양). 처음엔 아무것도 고르지 않은 상태라 아래 상품 칸이 잠겨 있다.
 * 누르면 맨 위 "직접 입력" + 마스터 목록(이름순 앞 10건, 이름·제조사·번호를 치면 걸러짐)이 열린다.
 * - 마스터를 고르면 상품 칸(카테고리·상품명·제조사·번호·제조일·사양)이 마스터 값으로 채워진 채 잠기고, 마스터의 데이터시트·사진 키는 폼에 따로 담긴다.
 * - "직접 입력"을 고르면 상품 칸이 비워져 열린다. 입력한 상품은 서버가 새 마스터로 저장한다.
 */
export function ProductPicker() {
  const { setValue, resetField, control } = useFormContext<ListingFormInput>();
  const prodId = useWatch({ control, name: "prodId" });
  const manual = useWatch({ control, name: "manual" }) === "1";
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

  // touched 로 만들지 않는다 — 고른 값을 채울 뿐 사용자가 칸을 건드린 게 아니다 (오류·초록 테두리는 직접 입력일 때 칸을 벗어난 뒤에야)
  const set = (field: ProductField, value: string) => setValue(field, value, { shouldValidate: true, shouldDirty: true });

  const pickMaster = (p: ProductSearchItem) => {
    set("manual", "");
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

  const pickManual = () => {
    // 이미 직접 입력 중이면 쳐 둔 값을 지우지 않는다. 마스터에서 바꿔 오면 마스터 값을 비운다
    if (!manual) {
      // resetField: 값뿐 아니라 touched·오류도 비워, 직접 입력을 고르자마자 빨간 오류가 뜨지 않게
      for (const field of productFields) resetField(field, { defaultValue: "" });
      set("manual", "1");
    }
    setOpen(false);
  };

  const result = search && search.q === q ? search : null;
  const masters = result?.items ?? [];
  // 목록 번호: 0 = "직접 입력", 1~ = 마스터
  const count = 1 + masters.length;
  const choose = (index: number) => (index === 0 ? pickManual() : masters[index - 1] && pickMaster(masters[index - 1]!));
  // 직접 입력은 값이 아니라 입력 방식이라 칸에 글자로 두지 않는다 (아래 칸이 열리는 것으로 알 수 있다)
  const selectedLabel = prodId !== "" ? [name, brand, prodNo].filter(Boolean).join(" · ") : "";
  const status = result === null ? t.searching : result.items === null ? t.failed : result.items.length === 0 ? t.noResult : null;

  const optionClass = (i: number) => cn("px-3 py-2 cursor-pointer", i === active && "bg-primary-soft");

  return (
    <FieldShell inline label={t.label} htmlFor="productPicker" note={<span className="text-ink-3">{t.hint}</span>}>
      <div className="relative">
        <Input
          id="productPicker"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          maxLength={50}
          placeholder={manual ? t.manualPlaceholder : t.placeholder}
          // 열려 있으면 검색어, 닫혀 있으면 고른 것
          value={open ? query : selectedLabel}
          className={cn("h-11 px-3 text-[15px] bg-surface", (prodId !== "" || manual) && !open && "border-primary bg-primary-soft")}
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
              setActive((a) => Math.min(a + 1, count - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              // 등록 폼이 제출되지 않게. 열려 있으면 고르기
              e.preventDefault();
              if (open) choose(active);
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
            {/* mousedown 에서 막아야 입력의 blur 가 먼저 목록을 닫지 않는다 */}
            <li
              id={`${listId}-0`}
              role="option"
              aria-selected={manual}
              onMouseDown={(e) => {
                e.preventDefault();
                pickManual();
              }}
              onMouseEnter={() => setActive(0)}
              className={cn(optionClass(0), "border-b border-line-2")}
            >
              <span className="block text-[15px] font-semibold text-primary-dark">{t.manualOption}</span>
              <span className="block text-xs text-ink-2">{t.manualOptionNote}</span>
            </li>
            {status !== null ? (
              <li role="presentation" className={cn("px-3 py-2 text-sm", result?.items === null ? "text-down" : "text-ink-3")}>
                {status}
              </li>
            ) : (
              masters.map((p, i) => (
                <li
                  key={p.prodId}
                  id={`${listId}-${i + 1}`}
                  role="option"
                  aria-selected={p.prodId === prodId}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMaster(p);
                  }}
                  onMouseEnter={() => setActive(i + 1)}
                  className={optionClass(i + 1)}
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
    </FieldShell>
  );
}
