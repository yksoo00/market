"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { tradesApi } from "@/lib/api/trades";
import { formatPrice } from "@/lib/format";
import { groupQuoteRequests, isHandledCode, overStock, quantitySum } from "@/lib/quoteRequests";
import { cn } from "@/lib/utils";
import { trade } from "@/messages/trade";
import type { QuoteReplyResult, QuoteRequestItem } from "@/types/trade";

const t = trade.bulk;

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: QuoteRequestItem[]; total: number };

/** 줄마다의 처리 결과 — 성공은 회색으로 남기고, 실패는 사유와 함께 버튼을 유지한다 (이미 처리된 건은 줄 자체를 뺀다) */
type RowState = { kind: "done"; accepted: boolean } | { kind: "error"; message: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 닫을 때, 처리한 게 있으면 — 뒤의 요청 탭 목록을 다시 읽게 */
  onChanged: () => void;
}

/**
 * 받은 견적요청 한꺼번에 처리 (계획 2026-11-03-quote-bulk-reply.md). 모든 견적요청(오래된 순 30건)을 같은 상품끼리 묶어 보이고,
 * 위 [모두 수락]·[모두 거절]이나 줄마다 [수락]·[거절]로 처리한다. 모두 수락은 묶음 합계가 재고를 넘으면 그 묶음만 통째로 실패한다
 */
export function QuoteRequestsDialog({ open, onOpenChange, onChanged }: Props) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [removed, setRemoved] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const changed = useRef(false);

  useEffect(() => {
    let alive = true;
    void tradesApi.quoteRequests().then((res) => {
      if (!alive) return;
      setLoad(res.ok ? { kind: "ready", items: res.data.items, total: res.data.total } : { kind: "error" });
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const items = useMemo(() => (load.kind === "ready" ? load.items : []), [load]);
  const groups = useMemo(() => groupQuoteRequests(items), [items]);
  const pending = items.filter((i) => rows[i.tradeId]?.kind !== "done");

  // 처리 결과를 줄에 반영한다. 성공 = 회색 표시(수락이면 그 매물 재고도 줄인다), 이미 처리됨 = 줄 빼기, 그 밖의 실패 = 사유 표시
  const apply = (results: QuoteReplyResult[], accepted: boolean) => {
    if (load.kind !== "ready") return;
    const nextRows = { ...rows };
    const gone = new Set<string>();
    const spent = new Map<string, number>();
    for (const r of results) {
      const item = load.items.find((i) => i.tradeId === r.tradeId);
      if (!item) continue;
      if (r.ok) {
        nextRows[r.tradeId] = { kind: "done", accepted };
        if (accepted) spent.set(item.regDate, (spent.get(item.regDate) ?? 0) + item.orderQuantity);
        changed.current = true;
      } else if (isHandledCode(r.code)) {
        gone.add(r.tradeId);
        delete nextRows[r.tradeId];
        changed.current = true;
      } else {
        nextRows[r.tradeId] = { kind: "error", message: r.message ?? trade.errors[r.code ?? ""] ?? t.failed };
      }
    }
    setRows(nextRows);
    setRemoved((n) => n + gone.size);
    setLoad({
      ...load,
      items: load.items
        .filter((i) => !gone.has(i.tradeId))
        .map((i) => (spent.has(i.regDate) && i.stockQuantity !== null ? { ...i, stockQuantity: i.stockQuantity - (spent.get(i.regDate) ?? 0) } : i)),
    });
  };

  const replyAll = async (accept: boolean) => {
    if (pending.length === 0) return;
    const groupCount = new Set(pending.map((i) => i.regDate)).size;
    if (!window.confirm((accept ? t.confirmAcceptAll : t.confirmRejectAll)(pending.length, groupCount))) return;
    setBusy("all");
    setTopError(null);
    const res = await tradesApi.replyQuotes(
      pending.map((i) => i.tradeId),
      accept ? "accept" : "reject",
    );
    setBusy(null);
    if (res.ok) apply(res.data.results, accept);
    else setTopError(res.fields ? Object.values(res.fields).join(" ") : (trade.errors[res.code] ?? res.message));
  };

  // 줄마다 따로 — 지금 쓰는 단건 수락·거절 API 그대로 (합계가 재고를 넘는 묶음에서도 한 건씩은 된다)
  const replyOne = async (item: QuoteRequestItem, accept: boolean) => {
    setBusy(item.tradeId);
    setTopError(null);
    const res = await (accept ? tradesApi.accept(item.tradeId) : tradesApi.reject(item.tradeId));
    setBusy(null);
    apply(
      [
        res.ok
          ? { tradeId: item.tradeId, ok: true, tradeStats: accept ? "quoteAccepted" : "quoteRejected", code: null, message: null }
          : { tradeId: item.tradeId, ok: false, tradeStats: null, code: res.code, message: trade.errors[res.code] ?? res.message },
      ],
      accept,
    );
  };

  const close = (next: boolean) => {
    if (!next && changed.current) onChanged();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      {/* 낮은 칸(3분할 아래)에선 여백을 줄이고, 넘치면 모달 안에서 스크롤 (PurchaseDialog·QuoteDialog 와 같음) */}
      <DialogContent className="max-w-3xl flex flex-col gap-4 [@media(max-height:640px)]:gap-3 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>
        {load.kind === "loading" && <div className="h-28 rounded-md bg-line-2 animate-pulse" aria-busy="true" />}
        {load.kind === "error" && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
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
          </div>
        )}
        {load.kind === "ready" && (
          <>
            {load.total > load.items.length + removed && <p className="text-[13px] text-ink-2">{t.more(load.total, load.items.length + removed)}</p>}
            {removed > 0 && <p className="text-[13px] text-ink-2">{t.handledRemoved(removed)}</p>}
            {topError && (
              <p role="alert" className="text-[13px] text-down">
                {topError}
              </p>
            )}
            {items.length > 0 && pending.length === 0 && <p className="text-[13px] font-semibold text-ink">{t.allDone}</p>}
            {items.length === 0 ? (
              <p className="py-8 text-center text-[15px] font-bold text-ink">{removed > 0 || Object.keys(rows).length > 0 ? t.allDone : t.empty}</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void replyAll(true)}
                    disabled={busy !== null || pending.length === 0}
                    className="h-9 px-4 rounded-md bg-primary text-white text-[13px] font-bold hover:bg-primary-dark disabled:opacity-40"
                  >
                    {t.acceptAll(pending.length)}
                  </button>
                  <button
                    type="button"
                    onClick={() => void replyAll(false)}
                    disabled={busy !== null || pending.length === 0}
                    className="h-9 px-4 rounded-md border border-line text-[13px] font-medium text-ink-2 hover:bg-bg disabled:opacity-40"
                  >
                    {t.rejectAll(pending.length)}
                  </button>
                </div>
                <ul className="flex flex-col gap-3">
                  {groups.map((group) => {
                    const unhandled = group.items.filter((i) => rows[i.tradeId]?.kind !== "done");
                    const sum = quantitySum(unhandled);
                    const over = overStock(group.stock, sum);
                    return (
                      <li key={group.regDate} className="rounded-md border border-line">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-2 bg-bg px-3 py-2">
                          <span className="font-semibold text-ink">{t.group(group.prodName)}</span>
                          <span className="num text-[13px] text-ink-2">{t.stock(group.stock)}</span>
                          <span className={cn("num text-[13px]", over ? "font-semibold text-down" : "text-ink-2")}>{t.sum(sum)}</span>
                          {over && <span className="w-full text-[12px] text-down">{t.overStock}</span>}
                        </div>
                        <ul>
                          {group.items.map((item) => (
                            <Row key={item.tradeId} item={item} state={rows[item.tradeId]} busy={busy} onReply={(accept) => void replyOne(item, accept)} />
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
        <button type="button" onClick={() => close(false)} className="h-11 rounded-md border border-line text-[15px] font-medium text-ink-2 hover:bg-bg">
          {t.close}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Row({ item, state, busy, onReply }: { item: QuoteRequestItem; state: RowState | undefined; busy: string | null; onReply: (accept: boolean) => void }) {
  const done = state?.kind === "done";
  const buyer = item.buyerNickname ?? "-";
  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-2 px-3 py-2 first:border-t-0", done && "text-ink-3")}>
      <span className="w-28 truncate text-[13px] font-medium" title={buyer}>
        {buyer}
      </span>
      <span className="num w-14 text-right text-[13px] font-semibold">{trade.bulk.quantity(item.orderQuantity)}</span>
      <span className="num text-[13px]">
        {trade.bulk.wanted} {formatPrice(item.orderUnitPrice)}
        {item.salesUnitPrice !== null && (
          <span className="text-ink-3">
            {" "}
            / {trade.bulk.listed} {formatPrice(item.salesUnitPrice)}
          </span>
        )}
      </span>
      {item.reqDeliDate && (
        <span className="num text-[13px] text-ink-2">
          {trade.bulk.reqDeliDate} {item.reqDeliDate}
        </span>
      )}
      {item.remarks && (
        <span className="min-w-0 max-w-48 truncate text-[13px] text-ink-2" title={item.remarks}>
          {item.remarks}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        {done ? (
          <span className="text-[13px] font-semibold">{state.accepted ? trade.bulk.accepted : trade.bulk.rejected}</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onReply(true)}
              disabled={busy !== null}
              aria-label={trade.bulk.acceptAria(item.prodName, buyer)}
              className="h-8 px-3 rounded-md bg-primary text-white text-[13px] font-bold hover:bg-primary-dark disabled:opacity-40"
            >
              {trade.bulk.accept}
            </button>
            <button
              type="button"
              onClick={() => onReply(false)}
              disabled={busy !== null}
              aria-label={trade.bulk.rejectAria(item.prodName, buyer)}
              className="h-8 px-3 rounded-md border border-line text-[13px] font-medium text-ink-2 hover:bg-bg disabled:opacity-40"
            >
              {trade.bulk.reject}
            </button>
          </>
        )}
      </span>
      {state?.kind === "error" && (
        <p role="alert" className="w-full text-[12px] text-down">
          {state.message}
        </p>
      )}
    </li>
  );
}
