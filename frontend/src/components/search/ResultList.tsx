"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Icon } from "@/components/common/Icon";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/format";
import { activeFilterCount, buildSearchHref, clearFilters, listingHref, type SearchQuery } from "@/lib/search";
import { search as t } from "@/messages/search";
import type { ListingSearchItem } from "@/types/listing";

const r = t.result;
const keyOf = (i: ListingSearchItem) => `${i.userId}/${i.regDate}`;
const qty = new Intl.NumberFormat("ko-KR");
// 체크박스·링크 클릭이 행 클릭(상세 이동)으로 번지지 않게
const stop = (e: MouseEvent) => e.stopPropagation();

interface Props {
  items: ListingSearchItem[];
  query: SearchQuery;
}

// 선택 상태는 결과 집합마다 새로 시작한다 — 페이지에서 key={buildSearchHref(query)}로 다시 마운트
export function ResultList({ items, query }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // seq: 같은 문구가 연달아 나와도 알림 요소를 새로 그려 스크린리더가 다시 읽게 한다 (key 로 사용)
  const [notice, setNotice] = useState<number | null>(null);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allChecked = items.length > 0 && selected.size === items.length;
  const headerChecked = allChecked ? true : selected.size > 0 ? "indeterminate" : false;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(items.map(keyOf)));
  // TODO(거래 흐름 미정, decisions.md 미정 항목): 견적 요청 → 견적 확인 흐름이 정해지면 실제 동작으로 교체
  const showPending = () => setNotice((prev) => (prev ?? 0) + 1);
  const go = (item: ListingSearchItem) => router.push(listingHref(item));

  if (items.length === 0) return <Empty query={query} />;

  const actions = (size: string) => (
    <>
      <button
        type="button"
        disabled={selected.size === 0}
        onClick={showPending}
        className={`${size} px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none`}
      >
        {r.quote}
      </button>
      <button
        type="button"
        disabled={selected.size === 0}
        onClick={showPending}
        className={`${size} px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none`}
      >
        {r.buy}
      </button>
    </>
  );

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 min-h-8.5">
        <Checkbox
          className="@md:hidden"
          checked={headerChecked}
          onCheckedChange={toggleAll}
          aria-label={r.selectAll}
        />
        <p className="grow text-sm text-ink-2" aria-live="polite">
          <span className="font-bold text-ink">{r.count(items.length)}</span>
          {selected.size > 0 && r.selected(selected.size)}
        </p>
        <div className="hidden @md:flex gap-2">{actions("h-8.5")}</div>
      </div>

      {notice !== null && (
        <div key={notice} role="status" className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className="min-w-0">{r.pending}</span>
          <button type="button" aria-label={r.dismiss} onClick={() => setNotice(null)} className="shrink-0 text-ink-3 hover:text-ink">
            <Icon name="close" size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* 데스크톱: 표 */}
      {/* 상품명·부품상세만 남는 폭을 나눠 갖는다. 960보다 좁으면(태블릿·분할) 상품명이 눌리지 않게 표 안에서 가로 스크롤 */}
      <div className="hidden @md:block rounded-md border border-line bg-surface overflow-x-auto">
        <table className="w-full min-w-240 table-fixed text-[13px]">
          <colgroup>
            <col className="w-10" />
            <col className="w-35" />
            <col />
            <col className="w-30" />
            <col />
            <col className="w-18" />
            <col className="w-12" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-26" />
          </colgroup>
          <thead className="bg-bg text-xs font-medium text-ink-2">
            <tr className="h-10 text-left">
              <th scope="col" className="pl-3">
                <Checkbox checked={headerChecked} onCheckedChange={toggleAll} aria-label={r.selectAll} />
              </th>
              <th scope="col" className="px-2 font-medium">{t.columns.prodNo}</th>
              <th scope="col" className="px-2 font-medium">{t.columns.prodName}</th>
              <th scope="col" className="px-2 font-medium">{t.columns.brand}</th>
              <th scope="col" className="px-2 font-medium">{t.columns.description}</th>
              <th scope="col" className="px-2 font-medium text-center">{t.columns.dataSheet}</th>
              <th scope="col" className="px-2 font-medium text-center">{t.columns.photo}</th>
              <th scope="col" className="px-2 font-medium">{t.columns.state}</th>
              <th scope="col" className="px-2 font-medium text-right">{t.columns.quantity}</th>
              <th scope="col" className="pl-2 pr-3 font-medium text-right">{t.columns.price}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const key = keyOf(item);
              const done = item.tradeStatus === "completed";
              return (
                <tr
                  key={key}
                  onClick={() => go(item)}
                  className={`h-11 border-t border-line-2 cursor-pointer hover:bg-bg ${done ? "text-ink-3" : "text-ink"}`}
                >
                  <td className="pl-3" onClick={stop}>
                    <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} aria-label={r.selectRow(item.prodName)} />
                  </td>
                  <td className="px-2 num truncate">{item.prodNo ?? "–"}</td>
                  <td className="px-2 truncate font-medium">
                    <Link href={listingHref(item)} onClick={stop} className="hover:text-primary">
                      {item.prodName}
                    </Link>
                  </td>
                  <td className="px-2 truncate" title={item.prodBrand}>{item.prodBrand}</td>
                  <td className={`px-2 truncate ${done ? "" : "text-ink-2"}`} title={item.description ?? undefined}>{item.description ?? "–"}</td>
                  <td className="px-2 text-center"><Has on={item.hasDataSheet} icon="file" label={r.dataSheet} /></td>
                  <td className="px-2 text-center"><Has on={item.hasPhoto} icon="image" label={r.photo} /></td>
                  <td className="px-2 truncate">{done ? <CompletedBadge /> : item.prodState}</td>
                  <td className="px-2 num text-right">{qty.format(item.stockQuantity)}</td>
                  <td className="pl-2 pr-3 num text-right font-semibold">{formatPrice(item.salesUnitPrice)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 행 카드 */}
      <ul className="@md:hidden rounded-md border border-line bg-surface">
        {items.map((item, idx) => {
          const key = keyOf(item);
          const done = item.tradeStatus === "completed";
          return (
            <li
              key={key}
              onClick={() => go(item)}
              className={`flex gap-3 px-3 py-3 cursor-pointer ${idx > 0 ? "border-t border-line-2" : ""} ${done ? "text-ink-3" : "text-ink"}`}
            >
              <div className="pt-0.5" onClick={stop}>
                <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} aria-label={r.selectRow(item.prodName)} />
              </div>
              <div className="min-w-0 grow flex flex-col gap-1">
                <Link href={listingHref(item)} onClick={stop} className="truncate text-sm font-medium">
                  {item.prodName}
                </Link>
                <p className="truncate text-xs text-ink-2">
                  {item.prodBrand}
                  {item.prodNo && <span className="num"> · {item.prodNo}</span>}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  {done ? <CompletedBadge /> : <span className="text-ink-2">{item.prodState}</span>}
                  <span className="num text-ink-2">{qty.format(item.stockQuantity)}{r.qtyUnit}</span>
                  <span className="num font-semibold">{formatPrice(item.salesUnitPrice)}</span>
                  <span className="ml-auto flex gap-1.5">
                    <Has on={item.hasDataSheet} icon="file" label={r.dataSheet} />
                    <Has on={item.hasPhoto} icon="image" label={r.photo} />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 모바일: 선택하면 아래(탭바 위)에 고정. main 이 스크롤 칸이라 sticky 로 칸 바닥에 붙는다 */}
      {selected.size > 0 && (
        <div className="@md:hidden sticky bottom-0 -mx-4 px-4 py-2.5 flex gap-2 bg-surface border-t border-line [&>button]:flex-1">
          {actions("h-10")}
        </div>
      )}
    </section>
  );
}

function Has({ on, icon, label }: { on: boolean; icon: "file" | "image"; label: string }) {
  return on ? (
    <Icon name={icon} size={18} role="img" aria-label={label} aria-hidden={false} className="inline-block text-ink-2" />
  ) : (
    <span className="text-ink-3">
      <span aria-hidden="true">–</span>
      <span className="sr-only">{`${label} ${r.none}`}</span>
    </span>
  );
}

function CompletedBadge() {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] bg-line-2 text-ink-2 text-[11px] font-semibold">
      {r.completedBadge}
    </span>
  );
}

function Empty({ query }: { query: SearchQuery }) {
  const filtered = activeFilterCount(query) > 0;
  return (
    <div className="py-16 flex flex-col items-center gap-2 text-center">
      <p className="text-[15px] font-bold text-ink">{t.empty.title}</p>
      {filtered ? (
        <Link href={buildSearchHref(clearFilters(query))} className="text-[13px] text-primary font-medium hover:underline">
          {t.empty.reset}
        </Link>
      ) : (
        <p className="text-[13px] text-ink-2">{t.empty.tryOther}</p>
      )}
    </div>
  );
}
