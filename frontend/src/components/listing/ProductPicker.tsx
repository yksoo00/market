"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
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
 * 상품마스터 찾기. 이름·제조사·번호로 검색해 고르면 상품 칸(카테고리·상품명·제조사·번호·제조일·사양)이 마스터 값으로 채워지고
 * (읽기 전용), 마스터의 데이터시트·사진 키는 폼에 따로 담긴다. [직접 입력으로 바꾸기]를 누르면 비워져 직접 입력.
 * 마스터에 없으면 그냥 아래 칸에 직접 입력하면 된다 — 서버가 새 마스터로 저장한다.
 */
export function ProductPicker() {
  const { setValue, control } = useFormContext<ListingFormInput>();
  const prodId = useWatch({ control, name: "prodId" });
  const name = useWatch({ control, name: "prodName" });
  const brand = useWatch({ control, name: "prodBrand" });
  const prodNo = useWatch({ control, name: "prodNo" });
  const [query, setQuery] = useState("");
  // items null = 불러오지 못함. q 가 지금 검색어와 같을 때만 보여 준다 (늦게 온 이전 검색어 결과 무시)
  const [search, setSearch] = useState<Search | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q === "" || prodId !== "") return;
    let live = true;
    // 입력이 멈춘 뒤에 묻는다 (키 입력마다 요청하지 않게)
    const timer = setTimeout(() => {
      void catalogApi.searchProducts(q).then((r) => {
        if (live) setSearch({ q, items: r.ok ? r.data : null });
      });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, prodId]);

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
    setQuery("");
    setSearch(null);
  };

  const switchToManual = () => {
    for (const field of productFields) set(field, "");
  };

  if (prodId !== "") {
    return (
      <FieldShell inline label={t.label}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-primary bg-primary-soft px-3 py-2.5">
          <div className="min-w-0 grow">
            <p className="text-xs text-primary-dark">{t.selected}</p>
            <p className="text-[15px] font-semibold text-ink break-words">
              {name} <span className="font-normal text-ink-2">· {brand}</span>
              {prodNo && <span className="num font-normal text-ink-2"> · {prodNo}</span>}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={switchToManual}>
            {t.switchToManual}
          </Button>
        </div>
      </FieldShell>
    );
  }

  const result = search && search.q === q ? search : null;
  return (
    <FieldShell inline label={t.label} note={<span className="text-ink-3">{t.hint}</span>}>
      <div className="flex flex-col gap-2">
        <Input
          type="search"
          autoComplete="off"
          aria-label={t.label}
          placeholder={t.placeholder}
          value={query}
          maxLength={50}
          className="h-11 px-3 text-[15px] bg-surface"
          onChange={(e) => setQuery(e.target.value)}
          // 검색 칸에서 Enter 가 등록 폼을 제출하지 않게
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        {q !== "" && (
          <div className="rounded-md border border-line bg-surface">
            {result === null ? (
              <p className="px-3 py-2 text-sm text-ink-3">{t.searching}</p>
            ) : result.items === null ? (
              <p role="alert" className="px-3 py-2 text-sm text-down">
                {t.failed}
              </p>
            ) : result.items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-ink-3">{t.noResult}</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {result.items.map((p) => (
                  <li key={p.prodId}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      className="w-full px-3 py-2 text-left hover:bg-primary-soft focus-visible:bg-primary-soft outline-none"
                    >
                      <span className="block text-[15px] font-semibold text-ink break-words">{p.prodName}</span>
                      <span className="block text-xs text-ink-2 break-words">
                        {p.prodBrand}
                        {p.prodNo && <span className="num"> · {p.prodNo}</span>}
                        {p.categoryName && <span> · {p.categoryName}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </FieldShell>
  );
}
