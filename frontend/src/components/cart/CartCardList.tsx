"use client";

import { useState } from "react";
import { CartCard } from "@/components/cart/CartCard";
import { NoticeDialog, useNotice } from "@/components/common/NoticeDialog";
import { ResultDialog } from "@/components/common/ResultDialog";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { PurchaseDialog } from "@/components/trade/PurchaseDialog";
import { QuoteDialog, type QuoteTarget } from "@/components/trade/QuoteDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cartActionable, cartTotal, notifyCartChanged } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { listingHref } from "@/lib/search";
import { selectionKey } from "@/lib/selection";
import { MAX_QUOTE_ITEMS } from "@/lib/validation/quote";
import { cart } from "@/messages/cart";
import { common } from "@/messages/common";
import { search } from "@/messages/search";
import { trade } from "@/messages/trade";
import type { CartItem } from "@/types/cart";

const t = cart.page;
const p = trade.purchase;
const outline = "h-9 px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none";

interface Props {
  items: CartItem[];
  /** 빼기·비우기 — 부모가 서버에서 지우고 다시 읽는다 */
  onRemove: (tradeIds: string[]) => void;
  removing: boolean;
  /** +/- — 부모가 서버에 저장하고 다시 읽는다 */
  onChangeQuantity: (item: CartItem, quantity: number) => void;
  /** 수량을 저장하는 중인 줄의 거래ID */
  quantityBusy: string | null;
}

/**
 * 장바구니 카드 목록 (사용자 지시 2026-11-03 — 표를 쿠팡식 카드로). 위 줄: 전체 선택 · [장바구니 비우기],
 * 아래 고정 막대: 선택 N개 · 합계 · [선택 빼기]·[견적 요청]·[구매]. 구매·견적 규칙은 옛 표와 같다:
 * 구매는 한 번에 1개, 견적은 여러 개(최대 20, 같은 매물이 여러 줄이면 거절), 거래완료 줄은 빼고 알린 뒤 진행.
 * 선택은 이 화면의 상태다 — 사라진 줄(다른 칸에서 뺌·1시간 자동 삭제)은 걸러 센다
 */
export function CartCardList({ items, onRemove, removing, onChangeQuantity, quantityBusy }: Props) {
  const openTile = useTileOpen();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const { notice, show, close: closeNotice } = useNotice();
  const [buying, setBuying] = useState<CartItem | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [quoting, setQuoting] = useState<QuoteTarget[] | null>(null);
  const [quoted, setQuoted] = useState(false);

  const picked = items.filter((i) => selected.has(i.tradeId));
  const allChecked = items.length > 0 && picked.length === items.length;
  const headerChecked = allChecked ? true : picked.length > 0 ? "indeterminate" : false;
  const toggle = (tradeId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId);
      else next.add(tradeId);
      return next;
    });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(items.map((i) => i.tradeId)));
  const showNotice = (title: string, message: string) => show({ tone: "error", title, message });

  // 거래완료 매물은 장바구니에 남지만 견적·구매 대상이 아니다 — 빼고 알린 뒤(확인을 누르면) 이어서 진행한다 (빼기만 된다)
  const withTradeTargets = (proceed: (chosen: CartItem[]) => void) => {
    const actionable = picked.filter((i) => cartActionable(i.listing));
    if (actionable.length < picked.length) {
      show({ tone: "error", title: common.notice.someSkipped, message: t.completedSkipped, then: () => proceed(actionable) });
    } else {
      proceed(actionable);
    }
  };
  // 견적은 여러 매물을 한 번에 (서버 한도 20개). 모달 기본값 = 담을 때 입력한 값
  const quoteSelected = () =>
    withTradeTargets((chosen) => {
      if (chosen.length === 0) return;
      // 같은 상품이 여러 줄이어도 견적은 매물당 한 건이다
      if (new Set(chosen.map((i) => selectionKey(i.listing))).size < chosen.length) showNotice(common.notice.quoteBlocked, trade.quote.sameListing);
      else if (chosen.length > MAX_QUOTE_ITEMS) showNotice(common.notice.quoteBlocked, trade.quote.tooMany(MAX_QUOTE_ITEMS));
      else
        setQuoting(
          chosen.map((i) => ({
            sellerId: i.listing.userId,
            regDate: i.listing.regDate,
            defaults: { orderQuantity: i.orderQuantity, reqDeliDate: i.reqDeliDate, remarks: i.remarks, cartTradeId: i.tradeId, addedAt: i.addedAt },
          })),
        );
    });
  // 구매 모달은 매물 1개용 — 여러 개를 골랐으면 하나만 고르라고 알린다
  const buySelected = () =>
    withTradeTargets((chosen) => {
      if (chosen.length === 1) setBuying(chosen[0]);
      else if (chosen.length > 1) showNotice(common.notice.buyBlocked, p.oneAtATime);
    });
  const clearAll = () => {
    if (!window.confirm(t.clearConfirm)) return;
    onRemove(items.map((i) => i.tradeId));
  };
  // 요약은 구매·견적에 들어갈 줄(거래완료 제외)만 센다 — 개수와 합계가 서로 어긋나지 않게
  const actionablePicked = picked.filter((i) => cartActionable(i.listing));
  const total = cartTotal(actionablePicked.map((i) => ({ unitPrice: i.listing.salesUnitPrice, quantity: i.orderQuantity })));

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 min-h-8.5">
        <Checkbox checked={headerChecked} onCheckedChange={toggleAll} aria-label={t.selectAll} />
        <p className="grow text-sm text-ink-2" aria-live="polite">
          <span className="font-bold text-ink">{t.count(items.length)}</span>
          {picked.length > 0 && search.result.selected(picked.length)}
        </p>
        <button
          type="button"
          disabled={removing}
          onClick={clearAll}
          className="h-8.5 px-3 rounded-md border border-line text-ink-2 text-sm font-medium hover:bg-bg disabled:opacity-40 disabled:pointer-events-none"
        >
          {t.clearAll}
        </button>
      </div>

      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <CartCard
            key={item.tradeId}
            item={item}
            checked={selected.has(item.tradeId)}
            onCheckedChange={() => toggle(item.tradeId)}
            quantityBusy={quantityBusy === item.tradeId}
            removing={removing}
            onChangeQuantity={(quantity) => onChangeQuantity(item, quantity)}
            onRemove={() => onRemove([item.tradeId])}
            onOpen={() => openTile(listingHref(item.listing), false)}
          />
        ))}
      </ul>

      {/* 고르면 아래에 붙어 따라온다. 선택이 없으면 버튼이 모두 꺼진다 */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-4 py-3">
        <p className="text-sm font-bold text-ink" aria-live="polite">
          {t.summary(actionablePicked.length, formatPrice(total))}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={picked.length === 0 || removing}
            onClick={() => onRemove(picked.map((i) => i.tradeId))}
            className="h-9 px-3 rounded-md border border-line text-ink-2 text-sm font-medium hover:bg-bg disabled:opacity-40 disabled:pointer-events-none"
          >
            {t.removeSelected}
          </button>
          <button type="button" disabled={picked.length === 0} onClick={quoteSelected} className={outline}>
            {search.result.quote}
          </button>
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={buySelected}
            className="h-9 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none"
          >
            {search.result.buy}
          </button>
        </div>
      </div>

      {buying && (
        <PurchaseDialog
          sellerId={buying.listing.userId}
          regDate={buying.listing.regDate}
          open
          defaultQuantity={buying.orderQuantity}
          defaultReqDeliDate={buying.reqDeliDate}
          defaultRemarks={buying.remarks ?? undefined}
          cartTradeId={buying.tradeId}
          onOpenChange={(open) => !open && setBuying(null)}
          onPurchased={() => {
            // 서버가 그 줄을 장바구니에서 지웠다 — 헤더 숫자와 이 목록을 맞춘다
            notifyCartChanged();
            setPurchased(true);
          }}
        />
      )}
      {quoting && (
        <QuoteDialog
          targets={quoting}
          open
          onOpenChange={(open) => !open && setQuoting(null)}
          onRequested={() => {
            notifyCartChanged();
            setQuoted(true);
          }}
        />
      )}
      <ResultDialog
        open={quoted}
        tone="success"
        title={trade.quote.doneTitle}
        message={trade.quote.doneMessage}
        actionLabel={p.toPurchases}
        onAction={() => {
          setQuoted(false);
          openTile("/my/activity?tab=purchases", false);
        }}
        onClose={() => setQuoted(false)}
      />
      <ResultDialog
        open={purchased}
        tone="success"
        title={p.doneTitle}
        message={p.doneMessage}
        actionLabel={p.toPurchases}
        onAction={() => {
          setPurchased(false);
          openTile("/my/activity?tab=purchases", false);
        }}
        onClose={() => setPurchased(false)}
      />
      <NoticeDialog notice={notice} onClose={closeNotice} />
    </section>
  );
}
