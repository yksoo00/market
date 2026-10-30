"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { DetailFilter } from "@/components/common/DetailFilter";
import { NoticeDialog, useNotice } from "@/components/common/NoticeDialog";
import { Pager } from "@/components/common/Pager";
import { ResultDialog } from "@/components/common/ResultDialog";
import { PurchaseDialog } from "@/components/trade/PurchaseDialog";
import { QuoteDialog } from "@/components/trade/QuoteDialog";
import { tradesApi } from "@/lib/api/trades";
import { notifyCartChanged } from "@/lib/cart";
import { filterParams, type FilterValues } from "@/lib/detailFilter";
import { historyFieldFromApi } from "@/lib/historyFilter";
import { formatPrice } from "@/lib/format";
import { tabPageHref } from "@/lib/myTabs";
import { listingHref } from "@/lib/search";
import { rowActions, type RowAction } from "@/lib/tradeActions";
import { emptyTradeFilter, TRADE_STATUS_VALUES, tradeFields } from "@/lib/tradeFilter";
import { listFilterSchema } from "@/lib/validation/historyFilter";
import { common } from "@/messages/common";
import { my } from "@/messages/my";
import { trade } from "@/messages/trade";
import type { Trade, TradeRole, TradeStats } from "@/types/trade";

const t = trade.list;
const c = t.columns;
const qty = new Intl.NumberFormat("ko-KR");

type Load = { kind: "loading" } | { kind: "error"; fields?: Record<string, string> } | { kind: "ready"; items: Trade[]; page: number; totalPages: number; total: number };

interface Props {
  /** buyer = 내 구매목록, seller = 받은 구매요청 */
  role: TradeRole;
  /** 진행 중인 거래만 (내 활동내역). 생략하면 확정된 것까지 전부 */
  active?: boolean;
  /** seller 일 때 이 매물(regDate)의 요청만 */
  reg?: string;
  /** 보는 페이지 (1부터). 주소 ?page= 에서 부모가 읽어 넘긴다 */
  page: number;
  /** 번호 줄 링크의 경로·쿼리 (서버 화면에서 클라이언트로 함수는 못 넘겨서 값으로 받는다). pageParams 는 탭 등 기본 쿼리 — 검색·필터 값은 filter 에서 더한다 */
  pagePath: string;
  pageParams: Record<string, string | undefined>;
  /** 검색어·상태·기간·금액·정렬 (주소에서 읽은 값). 바뀌면 부모가 key 로 다시 마운트한다 */
  filter: FilterValues;
}

/**
 * 거래 목록 (스펙 2026-10-15-purchase-design.md·2026-10-20-quote-request-design.md "화면"). 구매자·판매자 화면이 같이 쓴다.
 * 줄마다 누를 수 있는 버튼은 lib/tradeActions. 취소하면 행이 지워져 줄을 뺀다. 상대가 먼저 처리했으면(409·404) 목록을 다시 읽는다.
 */
export function TradeList({ role, reg, active, page, pagePath, pageParams, filter }: Props) {
  const router = useRouter();
  const fields = useMemo(() => tradeFields(role), [role]);
  const schema = useMemo(() => listFilterSchema(TRADE_STATUS_VALUES[role]), [role]);
  const fparams = filterParams(fields, filter, "q");
  const filtered = Object.keys(fparams).length > 0;
  const hrefFor = (n: number) => tabPageHref(pagePath, { ...pageParams, ...fparams }, n);
  const applyFilter = (values: FilterValues) =>
    router.push(tabPageHref(pagePath, { ...pageParams, ...filterParams(fields, values, "q") }, 1));
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  // 올리면 지금 페이지를 다시 읽는다
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  // 처리 실패 안내는 모달로 (사용자 지시 2026-10-30 — 클릭 뒤 안내는 전부 모달)
  const { notice, show: showNotice, close: closeNotice } = useNotice();
  // 수락된 견적 줄의 [구매] — 바뀐 매물을 지금 구매 모달로 산다
  const [buying, setBuying] = useState<Trade | null>(null);
  const [purchased, setPurchased] = useState(false);
  // 거절된 견적 줄의 [재요청] — 같은 매물에 견적 요청 모달을 다시 연다 (서버가 기존 견적 행을 덮어쓴다)
  const [requoting, setRequoting] = useState<Trade | null>(null);
  const [requoted, setRequoted] = useState(false);
  const asBuyer = role === "buyer";

  useEffect(() => {
    let alive = true;
    void tradesApi.list(role, { reg, active, page, filter }).then((res) => {
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
  }, [role, reg, active, page, filter, attempt]);

  const reload = () => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
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
    showNotice({ tone: "error", title: common.notice.tradeActionFailed, message: trade.errors[res.code] ?? res.message });
    // 상대가 먼저 처리했으면(지워졌으면 404) 지금 상태를 다시 보여 준다
    if (res.code === "TRADE_NOT_PENDING" || res.code === "TRADE_NOT_FOUND") setAttempt((n) => n + 1);
  };

  return (
    <section className="flex flex-col gap-3">
      <DetailFilter
        labels={{
          toolbar: my.activityFilter.label,
          searchPlaceholder: my.history.filter.searchPlaceholder,
          search: my.history.filter.search,
          detail: my.history.filter.detail,
          detailChip: my.history.filter.detailChip,
          apply: my.history.filter.apply,
          resetPopup: my.history.filter.resetPopup,
          reset: my.history.filter.reset,
        }}
        searchKey="q"
        fields={fields}
        schema={schema}
        values={filter}
        empty={emptyTradeFilter()}
        onApply={applyFilter}
        serverErrors={load.kind === "error" ? load.fields : undefined}
      />
      {filtered && load.kind === "ready" && <p className="px-1 text-[13px] text-ink-2">{my.history.filter.resultCount(load.total)}</p>}
      {reg && (
        <div className="flex items-center gap-3 text-[13px] text-ink-2">
          <span className="grow">{my.sales.filtered}</span>
          <Link href="/my/activity?tab=requests" className="shrink-0 text-primary font-medium hover:underline">
            {my.sales.showAll}
          </Link>
        </div>
      )}
      <NoticeDialog notice={notice} onClose={closeNotice} />
      <Body load={load} asBuyer={asBuyer} busy={busy} onAct={act} onRetry={reload} firstPageHref={page > 1 ? hrefFor(1) : null} filtered={filtered} />
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
      {load.kind === "ready" && <Pager page={load.page} totalPages={load.totalPages} total={load.total} hrefFor={hrefFor} />}
    </section>
  );
}

interface BodyProps {
  load: Load;
  asBuyer: boolean;
  busy: string | null;
  onAct: (item: Trade, what: RowAction) => void;
  onRetry: () => void;
  /** 2페이지 이후를 못 읽었을 때(건수가 줄어 범위 밖이 된 경우 등) 1페이지로 가는 주소 */
  firstPageHref: string | null;
  /** 검색어·필터가 걸려 있나 — 빈 결과를 "아직 없어요"가 아니라 "조건에 맞는 게 없어요"로 */
  filtered: boolean;
}

function Body({ load, asBuyer, busy, onAct, onRetry, firstPageHref, filtered }: BodyProps) {
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
        {firstPageHref && (
          <Link href={firstPageHref} className="text-[13px] text-primary font-medium hover:underline">
            {t.firstPage}
          </Link>
        )}
      </div>
    );
  }
  if (load.items.length === 0 && filtered) {
    return (
      <div className="py-16 flex flex-col items-center gap-2 text-center bg-surface border border-line rounded-md">
        <p className="text-[15px] font-bold text-ink">{my.activityFilter.emptyTitle}</p>
        <p className="text-[13px] text-ink-2">{my.activityFilter.emptyDesc}</p>
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
