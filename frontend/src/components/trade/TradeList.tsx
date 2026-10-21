"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { ResultDialog } from "@/components/common/ResultDialog";
import { PurchaseDialog } from "@/components/trade/PurchaseDialog";
import { QuoteDialog } from "@/components/trade/QuoteDialog";
import { tradesApi } from "@/lib/api/trades";
import { notifyCartChanged } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { listingHref } from "@/lib/search";
import { rowActions, type RowAction } from "@/lib/tradeActions";
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
 * 거래 목록 (스펙 2026-10-15-purchase-design.md·2026-10-20-quote-request-design.md "화면"). 구매자·판매자 화면이 같이 쓴다.
 * 줄마다 누를 수 있는 버튼은 lib/tradeActions. 취소하면 행이 지워져 줄을 뺀다. 상대가 먼저 처리했으면(409·404) 목록을 다시 읽는다.
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
  // 수락된 견적 줄의 [구매] — 바뀐 매물을 지금 구매 모달로 산다
  const [buying, setBuying] = useState<Trade | null>(null);
  const [purchased, setPurchased] = useState(false);
  // 거절된 견적 줄의 [재요청] — 같은 매물에 견적 요청 모달을 다시 연다 (서버가 기존 견적 행을 덮어쓴다)
  const [requoting, setRequoting] = useState<Trade | null>(null);
  const [requoted, setRequoted] = useState(false);
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

  const confirmText: Record<Exclude<RowAction, "buy" | "requote">, (item: Trade) => string> = {
    complete: () => t.confirmComplete,
    cancel: (item) => (item.tradeStats.startsWith("quote") ? t.confirmCancelQuote : t.confirmCancel),
    accept: () => t.confirmAccept,
    reject: () => t.confirmReject,
  };

  const act = async (item: Trade, what: RowAction) => {
    if (what === "buy") {
      setBuying(item);
      return;
    }
    if (what === "requote") {
      setRequoting(item);
      return;
    }
    if (!window.confirm(confirmText[what](item))) return;
    setBusy(item.tradeId);
    const res = await (what === "cancel" ? tradesApi.cancel(item.tradeId) : tradesApi[what](item.tradeId));
    setBusy(null);
    if (res.ok) {
      setLoad((prev) => {
        if (prev.kind !== "ready") return prev;
        // 취소는 행이 지워진다(204) — 줄을 뺀다
        if (res.data === null) return { ...prev, items: prev.items.filter((i) => i.tradeId !== item.tradeId) };
        const updated = res.data;
        return { ...prev, items: prev.items.map((i) => (i.tradeId === updated.tradeId ? updated : i)) };
      });
      return;
    }
    setMessage((prev) => ({ seq: (prev?.seq ?? 0) + 1, text: trade.errors[res.code] ?? res.message }));
    // 상대가 먼저 처리했으면(지워졌으면 404) 지금 상태를 다시 보여 준다
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
      {buying && (
        <PurchaseDialog
          sellerId={buying.sellerId}
          regDate={buying.regDate}
          // 수락된 견적이면 그 행이 구매요청이 된다 — 새 줄이 생기지 않는다
          quoteTradeId={buying.tradeId}
          defaultQuantity={buying.orderQuantity}
          open
          onOpenChange={(open) => !open && setBuying(null)}
          // 그 줄이 구매요청으로 바뀌었으니 목록을 다시 읽고, 구매 모달을 연 다른 곳과 같은 완료 안내를 띄운다
          onPurchased={() => {
            // 서버가 그 매물을 장바구니에서 지웠다 — 헤더 숫자를 맞춘다
            notifyCartChanged();
            setPurchased(true);
            reload();
          }}
        />
      )}
      {requoting && (
        <QuoteDialog
          targets={[{ sellerId: requoting.sellerId, regDate: requoting.regDate }]}
          open
          onOpenChange={(open) => !open && setRequoting(null)}
          // 같은 행이 견적요청으로 돌아갔으니 목록을 다시 읽는다
          onRequested={() => {
            notifyCartChanged();
            setRequoted(true);
            reload();
          }}
        />
      )}
      <ResultDialog
        open={requoted}
        tone="success"
        title={trade.quote.doneTitle}
        message={trade.quote.doneMessage}
        actionLabel={t.confirmDone}
        onAction={() => setRequoted(false)}
        onClose={() => setRequoted(false)}
      />
      <ResultDialog
        open={purchased}
        tone="success"
        title={trade.purchase.doneTitle}
        message={trade.purchase.doneMessage}
        actionLabel={t.confirmDone}
        onAction={() => setPurchased(false)}
        onClose={() => setPurchased(false)}
      />
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
  onAct: (item: Trade, what: RowAction) => void;
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

  const actions = (item: Trade) => {
    const list = rowActions(item, asBuyer);
    if (list.length === 0) return null;
    return (
      <div className="flex gap-1.5 justify-end">
        {list.map((what) => (
          <button
            key={what}
            type="button"
            onClick={() => onAct(item, what)}
            disabled={busy !== null}
            aria-label={actionAria[what](item.prodName)}
            className={cn(
              "h-8 px-3 rounded-md text-[13px] disabled:opacity-40",
              primaryActions.has(what)
                ? "bg-primary text-white font-bold hover:bg-primary-dark"
                : "border border-line font-medium text-ink-2 hover:bg-bg",
            )}
          >
            {t[what]}
          </button>
        ))}
      </div>
    );
  };
  // 견적 줄: 희망단가를 크게, 등록단가를 곁에 (한 줄에 화살표로 이어 쓰면 수량·금액과 섞여 읽기 어렵다)
  // 구매 단계로 이어진 행은 구매 줄처럼 (그때부턴 희망단가가 아니라 구매 단가)
  const isQuote = (item: Trade) => item.tradeStats.startsWith("quote") && item.salesUnitPrice !== null;
  const unitPrice = (item: Trade) =>
    isQuote(item) ? (
      <>
        <span>{formatPrice(item.orderUnitPrice)}</span>
        <span className="block text-[11px] text-ink-3">
          {t.listedPrice} {formatPrice(item.salesUnitPrice ?? 0)}
        </span>
      </>
    ) : (
      formatPrice(item.orderUnitPrice)
    );
  const counterpart = asBuyer ? c.seller : c.buyer;

  return (
    <>
      {/* 넓은 칸: 표. 좁은 칸(휴대폰·1/4 타일): 카드 — 기준은 검색 결과와 같은 칸 폭 576 */}
      <div className="hidden @min-[36rem]:block overflow-x-auto bg-surface border border-line rounded-md">
        <table className="w-full min-w-4xl text-sm">
          <thead className="bg-bg text-[12px] text-ink-2">
            <tr>
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
                <td className="px-3 py-2.5">
                  <Link href={listingHref({ userId: item.sellerId, regDate: item.regDate })} className="font-medium hover:text-primary">
                    {item.prodName}
                  </Link>
                  {item.remarks && <p className="mt-0.5 text-[12px] text-ink-2 wrap-break-word">{item.remarks}</p>}
                </td>
                <td className="px-3 py-2.5 truncate">{item.counterpartNickname ?? "-"}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{qty.format(item.orderQuantity)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{unitPrice(item)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold">{formatPrice(item.amount)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{item.reqDeliDate ?? "-"}</td>
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
              {counterpart} {item.counterpartNickname ?? "-"} · {c.reqDeliDate} <span className="font-mono">{item.reqDeliDate ?? "-"}</span>
            </p>
            {isQuote(item) ? (
              <div className="text-[13px] font-mono tabular-nums flex flex-col gap-0.5">
                <p>
                  <span className="font-sans text-ink-2">{c.quantity}</span> {qty.format(item.orderQuantity)}
                </p>
                <p>
                  <span className="font-sans text-ink-2">{t.wantedPrice}</span> {formatPrice(item.orderUnitPrice)}
                  <span className="ml-1.5 text-[11px] text-ink-3">
                    {t.listedPrice} {formatPrice(item.salesUnitPrice ?? 0)}
                  </span>
                </p>
                <p>
                  <span className="font-sans text-ink-2">{c.amount}</span> <span className="font-bold">{formatPrice(item.amount)}</span>
                </p>
              </div>
            ) : (
              <p className="text-[13px] font-mono tabular-nums">
                {qty.format(item.orderQuantity)} × {unitPrice(item)} = <span className="font-bold">{formatPrice(item.amount)}</span>
              </p>
            )}
            {item.remarks && <p className="text-[12px] text-ink-2 wrap-break-word">{item.remarks}</p>}
            {actions(item)}
          </li>
        ))}
      </ul>
    </>
  );
}

const statsClass: Record<TradeStats, string> = {
  cart: "bg-line-2 text-ink-2",
  compare: "bg-line-2 text-ink-2",
  quoteRequested: "bg-green-soft text-green",
  quoteAccepted: "bg-up/10 text-up",
  quoteRejected: "bg-down/10 text-down",
  requested: "bg-primary-soft text-primary",
  confirmed: "bg-up/10 text-up",
};

/** 채운 버튼 — 그 줄에서 주로 누를 것 */
const primaryActions = new Set<RowAction>(["complete", "accept", "buy", "requote"]);

const actionAria: Record<RowAction, (name: string) => string> = {
  complete: t.completeAria,
  cancel: t.cancelAria,
  accept: t.acceptAria,
  reject: t.rejectAria,
  buy: t.buyAria,
  requote: t.requoteAria,
};

function StatsBadge({ stats }: { stats: TradeStats }) {
  return (
    <span className={cn("inline-flex items-center h-5 px-1.5 rounded-[5px] text-[11px] font-semibold whitespace-nowrap", statsClass[stats])}>
      {t.stats[stats]}
    </span>
  );
}
