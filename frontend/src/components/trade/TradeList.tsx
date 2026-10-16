"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { tradesApi } from "@/lib/api/trades";
import { formatPrice } from "@/lib/format";
import { listingHref } from "@/lib/search";
import { my } from "@/messages/my";
import { trade } from "@/messages/trade";
import type { Trade, TradeRole, TradeStats } from "@/types/trade";

const t = trade.list;
const c = t.columns;
const qty = new Intl.NumberFormat("ko-KR");

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: Trade[]; nextCursor: string | null };

interface Props {
  /** buyer = 내 구매목록, seller = 받은 구매요청 */
  role: TradeRole;
  /** seller 일 때 이 매물(regDate)의 요청만 */
  reg?: string;
}

/**
 * 거래 목록 (스펙 2026-10-15-purchase-design.md "화면"). 구매자·판매자 화면이 같이 쓴다.
 * 구매요청 상태인 행만 버튼 — 구매자: [거래완료]·[취소], 판매자: [취소]. 상대가 먼저 처리했으면(409) 목록을 다시 읽는다.
 */
export function TradeList({ role, reg }: Props) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  // 올리면 첫 페이지부터 다시 읽는다
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // seq: 같은 문구가 연달아 나와도 알림을 새로 그려 스크린리더가 다시 읽게 (key)
  const [message, setMessage] = useState<{ seq: number; text: string } | null>(null);
  const asBuyer = role === "buyer";

  useEffect(() => {
    let alive = true;
    void tradesApi.list(role, { reg }).then((res) => {
      if (!alive) return;
      setLoad(res.ok ? { kind: "ready", items: res.data.items, nextCursor: res.data.nextCursor } : { kind: "error" });
    });
    return () => {
      alive = false;
    };
  }, [role, reg, attempt]);

  const reload = () => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  const loadMore = async () => {
    if (load.kind !== "ready" || !load.nextCursor) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const res = await tradesApi.list(role, { reg, cursor: load.nextCursor });
    setLoadingMore(false);
    if (!res.ok) {
      setMoreFailed(true);
      return;
    }
    // 기다리는 동안 [거래완료]·[취소]로 바뀐 행을 잃지 않게 지금 상태에 붙인다 (요청 전 load 가 아니라)
    setLoad((prev) =>
      prev.kind === "ready" ? { kind: "ready", items: [...prev.items, ...res.data.items], nextCursor: res.data.nextCursor } : prev,
    );
  };

  const act = async (item: Trade, what: "complete" | "cancel") => {
    if (!window.confirm(what === "complete" ? t.confirmComplete : t.confirmCancel)) return;
    setBusy(item.tradeId);
    const res = await (what === "complete" ? tradesApi.complete(item.tradeId) : tradesApi.cancel(item.tradeId));
    setBusy(null);
    if (res.ok) {
      setLoad((prev) =>
        prev.kind === "ready" ? { ...prev, items: prev.items.map((i) => (i.tradeId === res.data.tradeId ? res.data : i)) } : prev,
      );
      return;
    }
    setMessage((prev) => ({ seq: (prev?.seq ?? 0) + 1, text: trade.errors[res.code] ?? res.message }));
    // 상대가 먼저 확정·취소했으면 지금 상태를 다시 보여 준다
    if (res.code === "TRADE_NOT_PENDING" || res.code === "TRADE_NOT_FOUND") setAttempt((n) => n + 1);
  };

  return (
    <section className="flex flex-col gap-3">
      {reg && (
        <div className="flex items-center gap-3 text-[13px] text-ink-2">
          <span className="grow">{my.sales.filtered}</span>
          <Link href="/my/sales" className="shrink-0 text-primary font-medium hover:underline">
            {my.sales.showAll}
          </Link>
        </div>
      )}
      {message && (
        <p key={message.seq} role="alert" className="text-[13px] text-down">
          {message.text}
        </p>
      )}
      <Body load={load} asBuyer={asBuyer} busy={busy} onAct={act} onRetry={reload} />
      {load.kind === "ready" && load.nextCursor && (
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="h-9 px-5 rounded-md border border-line text-sm font-medium text-ink-2 hover:bg-bg disabled:opacity-40"
          >
            {loadingMore ? t.loading : t.more}
          </button>
          {moreFailed && (
            <p role="alert" className="text-[13px] text-down">
              {t.loadFailed}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

interface BodyProps {
  load: Load;
  asBuyer: boolean;
  busy: string | null;
  onAct: (item: Trade, what: "complete" | "cancel") => void;
  onRetry: () => void;
}

function Body({ load, asBuyer, busy, onAct, onRetry }: BodyProps) {
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
        <button type="button" onClick={onRetry} className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft">
          {t.retry}
        </button>
      </div>
    );
  }
  if (load.items.length === 0) {
    const empty = asBuyer ? my.purchases : my.sales;
    return (
      <div className="py-16 flex flex-col items-center gap-2 text-center bg-surface border border-line rounded-md">
        <p className="text-[15px] font-bold text-ink">{empty.emptyTitle}</p>
        <p className="text-[13px] text-ink-2">{empty.emptyDesc}</p>
        {asBuyer && (
          <Link href="/search" className="text-[13px] text-primary font-medium hover:underline">
            {my.purchases.toSearch}
          </Link>
        )}
      </div>
    );
  }

  const actions = (item: Trade) =>
    item.tradeStats === "requested" && (
      <div className="flex gap-1.5 justify-end">
        {asBuyer && (
          <button
            type="button"
            onClick={() => onAct(item, "complete")}
            disabled={busy !== null}
            aria-label={t.completeAria(item.prodName)}
            className="h-8 px-3 rounded-md bg-primary text-white text-[13px] font-bold hover:bg-primary-dark disabled:opacity-40"
          >
            {t.complete}
          </button>
        )}
        <button
          type="button"
          onClick={() => onAct(item, "cancel")}
          disabled={busy !== null}
          aria-label={t.cancelAria(item.prodName)}
          className="h-8 px-3 rounded-md border border-line text-[13px] font-medium text-ink-2 hover:bg-bg disabled:opacity-40"
        >
          {t.cancel}
        </button>
      </div>
    );
  const counterpart = asBuyer ? c.seller : c.buyer;

  return (
    <>
      {/* 넓은 칸: 표. 좁은 칸(휴대폰·1/4 타일): 카드 — 기준은 검색 결과와 같은 칸 폭 576 */}
      <div className="hidden @min-[36rem]:block overflow-x-auto bg-surface border border-line rounded-md">
        <table className="w-full min-w-4xl text-sm">
          <thead className="bg-bg text-[12px] text-ink-2">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-28">{c.tradeId}</th>
              <th className="px-3 py-2.5 text-left font-medium">{c.product}</th>
              <th className="px-3 py-2.5 text-left font-medium w-28">{counterpart}</th>
              <th className="px-3 py-2.5 text-right font-medium w-20">{c.quantity}</th>
              <th className="px-3 py-2.5 text-right font-medium w-28">{c.unitPrice}</th>
              <th className="px-3 py-2.5 text-right font-medium w-32">{c.amount}</th>
              <th className="px-3 py-2.5 text-left font-medium w-28">{c.reqDeliDate}</th>
              <th className="px-3 py-2.5 text-left font-medium w-20">{c.status}</th>
              <th className="px-3 py-2.5 text-right font-medium w-40">{c.actions}</th>
            </tr>
          </thead>
          <tbody>
            {load.items.map((item) => (
              <tr key={item.tradeId} className="border-t border-line-2 align-top">
                <td className="px-3 py-2.5 font-mono tabular-nums text-ink-2">{item.tradeId}</td>
                <td className="px-3 py-2.5">
                  <Link href={listingHref({ userId: item.sellerId, regDate: item.regDate })} className="font-medium hover:text-primary">
                    {item.prodName}
                  </Link>
                  {item.remarks && <p className="mt-0.5 text-[12px] text-ink-2 wrap-break-word">{item.remarks}</p>}
                </td>
                <td className="px-3 py-2.5 truncate">{item.counterpartNickname ?? "-"}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{qty.format(item.orderQuantity)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatPrice(item.orderUnitPrice)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold">{formatPrice(item.amount)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{item.reqDeliDate}</td>
                <td className="px-3 py-2.5">
                  <StatsBadge stats={item.tradeStats} />
                </td>
                <td className="px-3 py-2.5">{actions(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="@min-[36rem]:hidden flex flex-col gap-2">
        {load.items.map((item) => (
          <li key={item.tradeId} className="bg-surface border border-line rounded-md p-3.5 flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <Link href={listingHref({ userId: item.sellerId, regDate: item.regDate })} className="grow min-w-0 truncate text-sm font-medium">
                {item.prodName}
              </Link>
              <StatsBadge stats={item.tradeStats} />
            </div>
            <p className="text-[12px] text-ink-2">
              {counterpart} {item.counterpartNickname ?? "-"} · {c.reqDeliDate} <span className="font-mono">{item.reqDeliDate}</span>
            </p>
            <p className="text-[13px] font-mono tabular-nums">
              {qty.format(item.orderQuantity)} × {formatPrice(item.orderUnitPrice)} = <span className="font-bold">{formatPrice(item.amount)}</span>
            </p>
            {item.remarks && <p className="text-[12px] text-ink-2 wrap-break-word">{item.remarks}</p>}
            <div className="flex items-center gap-2">
              <span className="grow font-mono text-[11px] text-ink-3">{item.tradeId}</span>
              {actions(item)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

const statsClass: Record<TradeStats, string> = {
  requested: "bg-primary-soft text-primary",
  confirmed: "bg-up/10 text-up",
  canceled: "bg-line-2 text-ink-3",
};

function StatsBadge({ stats }: { stats: TradeStats }) {
  return (
    <span className={cn("inline-flex items-center h-5 px-1.5 rounded-[5px] text-[11px] font-semibold whitespace-nowrap", statsClass[stats])}>
      {t.stats[stats]}
    </span>
  );
}
