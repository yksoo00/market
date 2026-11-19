"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DetailFilter } from "@/components/common/DetailFilter";
import { Pager } from "@/components/common/Pager";
import { SortableTh } from "@/components/common/SortableTh";
import { rememberXScroll, StickyXScroll } from "@/components/common/StickyXScroll";
import { tradesApi } from "@/lib/api/trades";
import { nextSort, sortStateOf, type ColumnSortValues } from "@/lib/columnSort";
import { formatPrice } from "@/lib/format";
import { filterParams, type FilterValues } from "@/lib/detailFilter";
import { emptyHistoryFilter, historyFieldFromApi, historyFields, HISTORY_SORT_COLUMNS, tradeSearchField, type HistorySort } from "@/lib/historyFilter";
import { formatTradeDate } from "@/lib/historyFormat";
import { tabPageHref } from "@/lib/myTabs";
import { historyFilterSchema } from "@/lib/validation/historyFilter";
import { my } from "@/messages/my";
import type { HistorySide, TradeHistoryItem } from "@/types/trade";

const t = my.history;
const c = t.columns;
const qty = new Intl.NumberFormat("ko-KR");

type Load = { kind: "loading" } | { kind: "error"; fields?: Record<string, string> } | { kind: "ready"; items: TradeHistoryItem[]; page: number; totalPages: number; total: number };

/**
 * 내 거래이력 목록 (구매확정된 거래, 페이지 번호) + 검색창·상세 필터 (계획 2026-10-30). 탭(side)·필터가 바뀌면 부모가 key 로 다시 마운트한다.
 * 전체 탭은 줄마다 구매/판매를 표시한다. 상대는 닉네임만. 필터 줄은 로딩·오류·빈 상태에서도 보여 초기화할 수 있게 한다.
 */
export function HistoryList({ side, page, filter }: { side: HistorySide; page: number; filter: FilterValues }) {
  const router = useRouter();
  const params = filterParams(historyFields, filter, "q", tradeSearchField);
  const filtered = Object.keys(params).length > 0;
  const hrefFor = (n: number) => tabPageHref("/my/history", { tab: side, ...params }, n);
  // scroll: false — 정렬·필터를 바꿔도 세로 스크롤이 맨 위로 튀지 않게 (가로 위치는 StickyXScroll 이 이어 간다)
  const apply = (values: FilterValues) =>
    router.push(tabPageHref("/my/history", { tab: side, ...filterParams(historyFields, values, "q", tradeSearchField) }, 1), { scroll: false });
  // 열 머리를 누르면 오름 → 내림 → 기본(최신순). 정렬이 바뀌면 1페이지로 — 정렬 칩과 같은 주소 규칙 (사용자 지시 2026-11-03)
  const sortBy = (values: ColumnSortValues<HistorySort>) => {
    rememberXScroll("history-table");
    apply({ ...filter, sort: nextSort(filter.sort ?? "latest", values, "latest") });
  };
  const th = (column: keyof typeof HISTORY_SORT_COLUMNS, label: string, className: string) => (
    <SortableTh
      label={label}
      state={sortStateOf(filter.sort ?? "latest", HISTORY_SORT_COLUMNS[column])}
      onSort={() => sortBy(HISTORY_SORT_COLUMNS[column])}
      className={className}
    />
  );
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void tradesApi.history(side, page, filter).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setLoad({ kind: "ready", ...res.data });
        return;
      }
      // 서버가 필드별로 돌려준 오류(검증 실패)는 해당 칸에 보인다
      const fields = res.fields
        ? Object.fromEntries(Object.entries(res.fields).map(([k, v]) => [historyFieldFromApi[k] ?? k, v]))
        : undefined;
      setLoad({ kind: "error", fields });
    });
    return () => {
      alive = false;
    };
  }, [side, page, filter, attempt]);

  const bar = (
    <DetailFilter
      labels={{
        toolbar: t.filter.label,
        searchPlaceholder: t.filter.searchPlaceholder,
        search: t.filter.search,
        filters: t.filter.chips,
        apply: t.filter.apply,
        reset: t.filter.reset,
        clear: t.filter.clear,
      }}
      searchKey="q"
      searchField={tradeSearchField}
      fields={historyFields}
      schema={historyFilterSchema}
      values={filter}
      empty={emptyHistoryFilter()}
      onApply={apply}
      serverErrors={load.kind === "error" ? load.fields : undefined}
    />
  );
  return (
    <section className="flex flex-col gap-3">
      {bar}
      {filtered && load.kind === "ready" && <p className="px-1 text-[13px] text-ink-2">{t.filter.resultCount(load.total)}</p>}
      {renderBody()}
    </section>
  );

  function renderBody() {
    if (load.kind === "loading") {
      return (
        <div className="py-16 text-center text-[13px] text-ink-2" aria-busy="true">
          {t.loading}
        </div>
      );
    }
    if (load.kind === "error") {
      return (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <p className="text-[15px] font-bold text-ink">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => {
              setLoad({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
          >
            {t.retry}
          </button>
          {page > 1 && (
            <Link href={hrefFor(1)} className="text-[13px] text-primary font-medium hover:underline">
              {t.firstPage}
            </Link>
          )}
        </div>
      );
    }
    if (load.items.length === 0) {
      return (
        <div className="py-16 flex flex-col items-center gap-2 text-center bg-surface border border-line rounded-md">
          <p className="text-[15px] font-bold text-ink">{filtered ? t.filter.emptyTitle : t.emptyTitle}</p>
          <p className="text-[13px] text-ink-2">{filtered ? t.filter.emptyDesc : t.emptyDesc}</p>
        </div>
      );
    }

    const sideLabel = (item: TradeHistoryItem) => t.sides[item.side];
    const money = (v: number | null) => (v === null ? "-" : formatPrice(v));
    return (
      <>
        {/* 넓은 칸: 표. 좁은 칸: 카드 — 기준은 거래 목록과 같은 칸 폭 576 */}
        <StickyXScroll memoryKey="history-table" className="hidden @min-[36rem]:block bg-surface border border-line rounded-md">
          {/* 칸 안 글자는 줄바꿈하지 않는다 (사용자 지시 2026-10-30) — 넘치면 표가 가로 스크롤 */}
          <table className="w-full min-w-3xl text-sm whitespace-nowrap">
            <thead className="bg-bg text-[12px] text-ink-2">
              <tr>
                {th("date", c.date, "px-3 py-2.5 text-left font-medium w-36")}
                {side === "all" && th("side", c.side, "px-3 py-2.5 text-left font-medium w-16")}
                {th("name", c.product, "px-3 py-2.5 text-left font-medium")}
                {th("unitPrice", c.unitPrice, "px-3 py-2.5 text-right font-medium w-28")}
                {th("quantity", c.quantity, "px-3 py-2.5 text-right font-medium w-20")}
                {th("amount", c.amount, "px-3 py-2.5 text-right font-medium w-32")}
                {th("party", c.counterpart, "px-3 py-2.5 text-left font-medium w-28")}
              </tr>
            </thead>
            <tbody>
              {load.items.map((item) => (
                <tr key={item.tradeId} className="border-t border-line-2">
                  <td className="px-3 py-2.5 font-mono tabular-nums">{formatTradeDate(item.tradeDate)}</td>
                  {side === "all" && <td className="px-3 py-2.5">{sideLabel(item)}</td>}
                  <td className="px-3 py-2.5 font-medium">{item.prodName ?? "-"}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{money(item.unitPrice)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{item.quantity === null ? "-" : qty.format(item.quantity)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold">{money(item.amount)}</td>
                  <td className="px-3 py-2.5 truncate">{item.counterpartNickname ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </StickyXScroll>
        <ul className="@min-[36rem]:hidden flex flex-col gap-2">
          {load.items.map((item) => (
            <li key={item.tradeId} className="bg-surface border border-line rounded-md p-3 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium wrap-break-word">{item.prodName ?? "-"}</span>
                {side === "all" && <span className="shrink-0 text-[12px] text-ink-2">{sideLabel(item)}</span>}
              </div>
              <p className="text-[12px] text-ink-2">
                {formatTradeDate(item.tradeDate)} · {item.counterpartNickname ?? "-"}
              </p>
              <p className="font-mono tabular-nums text-[13px]">
                {money(item.unitPrice)} × {item.quantity === null ? "-" : qty.format(item.quantity)} ={" "}
                <span className="font-bold">{money(item.amount)}</span>
              </p>
            </li>
          ))}
        </ul>
        <Pager page={load.page} totalPages={load.totalPages} total={load.total} hrefFor={hrefFor} />
      </>
    );
  }
}
