"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pager } from "@/components/common/Pager";
import { tradesApi } from "@/lib/api/trades";
import { formatPrice } from "@/lib/format";
import { formatTradeDate } from "@/lib/historyFormat";
import { tabPageHref } from "@/lib/myTabs";
import { my } from "@/messages/my";
import type { HistorySide, TradeHistoryItem } from "@/types/trade";

const t = my.history;
const c = t.columns;
const qty = new Intl.NumberFormat("ko-KR");

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: TradeHistoryItem[]; page: number; totalPages: number; total: number };

/**
 * 내 거래이력 목록 (구매확정된 거래, 최신 확정순, 페이지 번호). 탭(side)이 바뀌면 부모가 key 로 다시 마운트한다.
 * 전체 탭은 줄마다 구매/판매를 표시한다. 상대는 닉네임만.
 */
export function HistoryList({ side, page }: { side: HistorySide; page: number }) {
  const hrefFor = (n: number) => tabPageHref("/my/history", { tab: side }, n);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void tradesApi.history(side, page).then((res) => {
      if (!alive) return;
      setLoad(res.ok ? { kind: "ready", ...res.data } : { kind: "error" });
    });
    return () => {
      alive = false;
    };
  }, [side, page, attempt]);

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
        <p className="text-[15px] font-bold text-ink">{t.emptyTitle}</p>
        <p className="text-[13px] text-ink-2">{t.emptyDesc}</p>
      </div>
    );
  }

  const sideLabel = (item: TradeHistoryItem) => t.sides[item.side];
  const money = (v: number | null) => (v === null ? "-" : formatPrice(v));
  return (
    <section className="flex flex-col gap-3">
      {/* 넓은 칸: 표. 좁은 칸: 카드 — 기준은 거래 목록과 같은 칸 폭 576 */}
      <div className="hidden @min-[36rem]:block overflow-x-auto bg-surface border border-line rounded-md">
        <table className="w-full min-w-3xl text-sm">
          <thead className="bg-bg text-[12px] text-ink-2">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-36">{c.date}</th>
              {side === "all" && <th className="px-3 py-2.5 text-left font-medium w-16">{c.side}</th>}
              <th className="px-3 py-2.5 text-left font-medium">{c.product}</th>
              <th className="px-3 py-2.5 text-left font-medium w-28">{c.counterpart}</th>
              <th className="px-3 py-2.5 text-right font-medium w-28">{c.unitPrice}</th>
              <th className="px-3 py-2.5 text-right font-medium w-20">{c.quantity}</th>
              <th className="px-3 py-2.5 text-right font-medium w-32">{c.amount}</th>
            </tr>
          </thead>
          <tbody>
            {load.items.map((item) => (
              <tr key={item.tradeId} className="border-t border-line-2">
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatTradeDate(item.tradeDate)}</td>
                {side === "all" && <td className="px-3 py-2.5">{sideLabel(item)}</td>}
                <td className="px-3 py-2.5 font-medium">{item.prodName ?? "-"}</td>
                <td className="px-3 py-2.5 truncate">{item.counterpartNickname ?? "-"}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{money(item.unitPrice)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{item.quantity === null ? "-" : qty.format(item.quantity)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    </section>
  );
}
