"use client";

import { useEffect, useId, useState } from "react";
import { CategoryPickDialog } from "@/components/listing/CategoryPickDialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { catalogApi } from "@/lib/api/catalog";
import { pageItems } from "@/lib/pager";
import { applyFilter, buildProductSearchParams, initialProductFilter, type ProductFilter } from "@/lib/productSearch";
import { cn } from "@/lib/utils";
import { common } from "@/messages/common";
import { listing } from "@/messages/listing";
import type { ProductPageItem, ProductSearchItem, ProductSearchPage } from "@/types/listing";

const t = listing.bulk.search;

/** 지금 조건(쿼리 문자열)과 같을 때만 보여 준다 — 늦게 온 이전 조건의 응답이 새 결과를 덮지 않게. page null = 불러오지 못함 */
type Loaded = { key: string; page: ProductSearchPage | null };

interface Props {
  onPick: (item: ProductSearchItem) => void;
  onClose: () => void;
}

const inputClass = "h-9 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus-visible:border-primary";
const gridClass = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_4rem]";

/**
 * 상품마스터 큰 검색 모달 (계획 2026-11-09-product-search-modal.md). 검색어·카테고리·제조사로 좁히고 페이지 번호로 넘기며 상품 하나를 골라 [선택].
 * 등록 폼의 ProductPicker 는 react-hook-form 에 묶여 표 칸에서 쓸 수 없어 같은 검색 API 를 쓰는 독립 모달이다.
 * 판매 다량 등록·대량구매의 줄과 등록 폼의 [자세히 찾기]가 같이 쓴다 — props(onPick·onClose)는 예전 팝업과 같다
 */
export function ProductSearchDialog({ onPick, onClose }: Props) {
  const [filter, setFilter] = useState<ProductFilter>(initialProductFilter);
  // 글자를 치는 칸은 입력값을 따로 두고, 멈춘 뒤에 조건으로 넘긴다 (키 입력마다 요청하지 않게)
  const [qInput, setQInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selected, setSelected] = useState<ProductPageItem | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const listId = useId();
  const key = buildProductSearchParams(filter);

  useEffect(() => {
    const timer = setTimeout(() => setFilter((f) => applyFilter(f, { q: qInput.trim(), brand: brandInput.trim() })), qInput === "" && brandInput === "" ? 0 : 300);
    return () => clearTimeout(timer);
  }, [qInput, brandInput]);

  useEffect(() => {
    let live = true;
    void catalogApi.searchProductsPage(filter).then((r) => {
      if (!live) return;
      // 결과가 줄어 보던 페이지가 범위 밖이 되면(400 page) 1페이지로 돌아가 다시 읽는다 — [다시 시도]로는 같은 실패만 되풀이한다
      if (!r.ok && r.fields?.page && filter.page !== 1) {
        setFilter((f) => ({ ...f, page: 1 }));
        return;
      }
      setLoaded({ key, page: r.ok ? r.data : null });
    });
    return () => {
      live = false;
    };
    // filter 는 key 로 대표된다. attempt 는 [다시 시도]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const page = loaded && loaded.key === key ? loaded.page : undefined; // undefined = 아직 이 조건의 응답이 없음(로딩)
  const failed = loaded !== null && loaded.key === key && loaded.page === null;
  const hasFilter = filter.q !== "" || filter.category !== "" || filter.brand !== "";

  const resetAll = () => {
    setQInput("");
    setBrandInput("");
    setCategoryName("");
    setFilter(initialProductFilter);
  };

  const goPage = (p: number) => setFilter((f) => applyFilter(f, { page: p }));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-5xl flex flex-col gap-3 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-2">{t.qLabel}</span>
            <input autoFocus maxLength={50} value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={t.qPlaceholder} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-2">{t.brandLabel}</span>
            <input maxLength={50} value={brandInput} onChange={(e) => setBrandInput(e.target.value)} placeholder={t.brandPlaceholder} className={inputClass} />
          </label>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[12px] text-ink-2">{t.categoryLabel}</span>
            <span className="flex gap-1">
              <button type="button" onClick={() => setCategoryOpen(true)} className={cn(inputClass, "truncate text-left", filter.category === "" && "text-ink-3")} title={categoryName || filter.category}>
                {filter.category === "" ? t.categoryAll : categoryName || filter.category}
              </button>
              {filter.category !== "" && (
                <button
                  type="button"
                  aria-label={t.categoryClear}
                  onClick={() => {
                    setCategoryName("");
                    setFilter((f) => applyFilter(f, { category: "" }));
                  }}
                  className="h-9 shrink-0 rounded-md border border-line px-2 text-[13px] text-ink-2 hover:bg-bg"
                >
                  ×
                </button>
              )}
            </span>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={resetAll} disabled={!hasFilter && qInput === "" && brandInput === ""} className="h-9 rounded-md border border-line px-3 text-[13px] text-ink-2 hover:bg-bg disabled:opacity-40">
              {t.reset}
            </button>
          </div>
        </div>

        <div className="flex min-h-40 flex-col rounded-md border border-line">
          <div role="presentation" className={cn("hidden gap-2 border-b border-line bg-bg px-3 py-2 text-[12px] font-semibold text-ink-2 md:grid", gridClass)}>
            <span>{t.columns.name}</span>
            <span>{t.columns.brand}</span>
            <span>{t.columns.prodNo}</span>
            <span>{t.columns.classNo}</span>
            <span>{t.columns.category}</span>
            <span className="text-right">{t.columns.listings}</span>
          </div>
          {page === undefined && !failed && (
            <p role="status" aria-busy="true" className="py-10 text-center text-[13px] text-ink-2">
              {t.loading}
            </p>
          )}
          {failed && (
            <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-[13px] text-down">{t.failed}</p>
              <button
                type="button"
                onClick={() => {
                  setLoaded(null); // 불러오는 중으로 되돌려 눌렀다는 반응이 보이게
                  setAttempt((n) => n + 1);
                }}
                className="h-8 rounded-md border border-primary px-3 text-[13px] font-medium text-primary hover:bg-primary-soft">
                {t.retry}
              </button>
            </div>
          )}
          {page && page.items.length === 0 && <p role="status" className="px-4 py-10 text-center text-[13px] text-ink-2">{t.empty}</p>}
          {page && page.items.length > 0 && (
            <ul id={listId} aria-label={t.title} className="max-h-[46vh] overflow-y-auto divide-y divide-line-2">
              {page.items.map((p) => {
                const on = selected?.prodId === p.prodId;
                return (
                  <li key={p.prodId}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={t.chooseNamed(p.prodName)}
                      onClick={() => setSelected(p)}
                      onDoubleClick={() => onPick(p)}
                      className={cn("grid w-full grid-cols-1 gap-x-2 gap-y-0.5 px-3 py-2 text-left text-[13px] outline-none focus-visible:bg-bg md:items-center", gridClass, on ? "bg-primary-soft" : "hover:bg-bg")}
                    >
                      <span className="truncate font-semibold text-ink" title={p.prodName}>
                        {p.prodName}
                      </span>
                      <span className="truncate text-ink-2">{p.prodBrand}</span>
                      <span className={cn("truncate text-ink-2", !p.prodNo && "hidden md:block")}>{p.prodNo ?? "-"}</span>
                      <span className={cn("truncate text-ink-2", !p.prodClassNo && "hidden md:block")}>{p.prodClassNo ?? "-"}</span>
                      <span className="truncate text-ink-2" title={p.categoryName ?? p.categoryCode}>
                        {p.categoryName ?? p.categoryCode}
                      </span>
                      <span className={cn("num md:text-right", p.listingCount > 0 ? "font-semibold text-green" : "text-ink-3")}>{t.listingCount(p.listingCount)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {page && page.totalPages > 1 && (
          <nav aria-label={common.pager.label} className="flex flex-wrap items-center justify-center gap-1">
            <span className="mr-2 text-[13px] text-ink-2">{t.total(page.total)}</span>
            <PageButton label={common.pager.prev} disabled={page.page <= 1} onClick={() => goPage(page.page - 1)}>
              ‹
            </PageButton>
            {pageItems(page.page, page.totalPages).map((item, i) =>
              item === "gap" ? (
                <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-3">
                  …
                </span>
              ) : (
                <PageButton key={item} label={common.pager.go(item)} current={item === page.page} onClick={() => goPage(item)}>
                  {item}
                </PageButton>
              ),
            )}
            <PageButton label={common.pager.next} disabled={page.page >= page.totalPages} onClick={() => goPage(page.page + 1)}>
              ›
            </PageButton>
          </nav>
        )}
        {page && page.totalPages <= 1 && page.total > 0 && <p className="text-center text-[13px] text-ink-2">{t.total(page.total)}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] text-ink-2" aria-live="polite">
            {selected ? t.selected(selected.prodName) : t.nothingSelected}
          </p>
          <button type="button" onClick={onClose} className="h-10 rounded-md border border-line px-4 text-[14px] font-medium text-ink-2 hover:bg-bg">
            {listing.bulk.pick.cancel}
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onPick(selected)}
            className="h-10 rounded-md bg-primary px-5 text-[14px] font-bold text-white hover:bg-primary-dark disabled:opacity-40"
          >
            {t.choose}
          </button>
        </div>
      </DialogContent>

      {categoryOpen && (
        <CategoryPickDialog
          anyLevel
          value={filter.category}
          onClose={() => setCategoryOpen(false)}
          onPick={(code, name) => {
            setCategoryOpen(false);
            setCategoryName(name);
            setFilter((f) => applyFilter(f, { category: code }));
          }}
        />
      )}
    </Dialog>
  );
}

function PageButton({ label, current, disabled, onClick, children }: { label: string; current?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-w-8.5 h-8.5 px-2 inline-flex items-center justify-center rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40",
        current ? "bg-primary-soft font-bold text-primary-dark" : "text-ink-2 hover:bg-bg",
      )}
    >
      {children}
    </button>
  );
}
