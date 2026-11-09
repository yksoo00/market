"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { catalogApi } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";
import { listing } from "@/messages/listing";
import type { ProductSearchItem } from "@/types/listing";

const t = listing.bulk.pick;

type Search = { q: string; items: ProductSearchItem[] | null };

interface Props {
  onPick: (item: ProductSearchItem) => void;
  onClose: () => void;
}

/**
 * 다량 등록 줄에서 여는 상품마스터 검색 (계획 2026-11-06-bulk-listing-page.md). 등록 폼의 ProductPicker 는 react-hook-form 에 묶여
 * 표 칸에서 쓸 수 없어 같은 검색 API 로 따로 만든 독립 팝업이다. 고르면 그 마스터 값이 줄에 들어가고 줄의 상품 칸이 잠긴다
 */
export function ProductSearchDialog({ onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // items null = 불러오지 못함. q 가 지금 검색어와 같을 때만 보여 준다 (늦게 온 이전 검색어 결과 무시)
  const [search, setSearch] = useState<Search | null>(null);
  const listId = useId();
  const q = query.trim();

  useEffect(() => {
    let live = true;
    // 입력이 멈춘 뒤에 묻는다 (키 입력마다 요청하지 않게). 빈 검색어(열자마자)는 바로 — 이름순 앞쪽 마스터가 나온다
    const timer = setTimeout(
      () => {
        void catalogApi.searchProducts(q).then((r) => {
          if (live) setSearch({ q, items: r.ok ? r.data : null });
        });
      },
      q === "" ? 0 : 300,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  const result = search && search.q === q ? search : null;
  const items = result?.items ?? [];
  const status = result === null ? t.searching : result.items === null ? t.failed : result.items.length === 0 ? t.noResult : null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    // 한글 입력 중 글자를 확정하는 Enter 는 목록에서 고르는 Enter 가 아니다 (조합 중에는 isComposing)
    if (items.length === 0 || e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) onPick(item);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl flex flex-col gap-3 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.productTitle}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.productDesc}</DialogDescription>
        </div>
        <Input
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items.length > 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus
          maxLength={50}
          placeholder={t.productPlaceholder}
          value={query}
          className="h-10 px-3 text-[15px] bg-surface"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {status && (
          <p role={result?.items === null ? "alert" : "status"} className={cn("py-4 text-center text-[13px]", result?.items === null ? "text-down" : "text-ink-2")}>
            {status}
          </p>
        )}
        {items.length > 0 && (
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto rounded-md border border-line divide-y divide-line-2">
            {items.map((p, i) => (
              <li
                key={p.prodId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={cn("flex cursor-pointer flex-col gap-0.5 px-3 py-2", i === active && "bg-primary-soft")}
                onMouseEnter={() => setActive(i)}
                // 입력 칸의 blur 보다 먼저 처리돼야 고른 값이 사라지지 않는다
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(p);
                }}
              >
                <span className="text-[14px] font-semibold text-ink">{p.prodName}</span>
                <span className="text-[12px] text-ink-2">{[p.prodBrand, p.prodNo, p.prodClassNo, p.categoryName].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onClose} className="h-10 rounded-md border border-line text-[14px] font-medium text-ink-2 hover:bg-bg">
          {t.cancel}
        </button>
      </DialogContent>
    </Dialog>
  );
}
