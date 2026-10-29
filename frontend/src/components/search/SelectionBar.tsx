"use client";

import { Icon } from "@/components/common/Icon";
import { selectionKey } from "@/lib/selection";
import { cart } from "@/messages/cart";
import type { ListingSearchItem } from "@/types/listing";

const t = cart.selection;

interface Props {
  items: ListingSearchItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
}

/**
 * 검색 목록 위 "선택한 상품" 줄 (설계 2026-10-27 PR 3, 사용자 결정 2026-10-29). 체크한 상품이 계속 보여 자기가 뭘 골랐는지 알 수 있다.
 * 칩의 ✕ 로 그 상품만 뺀다. 목록에 안 보이는 상품(다른 검색에서 고른 것)도 여기서 보이고 뺄 수 있다.
 */
export function SelectionBar({ items, onRemove, onClear }: Props) {
  if (items.length === 0) return null;
  return (
    <section aria-label={t.title(items.length)} className="flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2">
      <p className="shrink-0 pt-1 text-[13px] font-bold text-ink">{t.title(items.length)}</p>
      <ul className="grow min-w-0 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={selectionKey(item)} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft pl-2.5 pr-1 h-7 text-[12px] text-primary-dark">
            <span className="truncate max-w-48" title={item.prodName}>
              {item.prodName}
            </span>
            <button
              type="button"
              aria-label={t.removeAria(item.prodName)}
              onClick={() => onRemove(selectionKey(item))}
              className="shrink-0 inline-flex size-5 items-center justify-center rounded-full hover:bg-primary/10"
            >
              <Icon name="close" size={12} strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClear} className="shrink-0 pt-1 text-[12px] text-ink-3 hover:text-ink hover:underline">
        {t.clear}
      </button>
    </section>
  );
}
