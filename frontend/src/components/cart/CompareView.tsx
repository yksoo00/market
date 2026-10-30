"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { NoticeDialog, useNotice } from "@/components/common/NoticeDialog";
import { ResultDialog } from "@/components/common/ResultDialog";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { PurchaseDialog } from "@/components/trade/PurchaseDialog";
import { QuoteDialog, type QuoteTarget } from "@/components/trade/QuoteDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cartApi } from "@/lib/api/cart";
import { listingsApi } from "@/lib/api/listings";
import { notifyCartChanged } from "@/lib/cart";
import { compareRows, MIN_COMPARE, sameKey } from "@/lib/compare";
import { fileUrl } from "@/lib/files";
import { mainPhoto } from "@/lib/listingDetail";
import { listingHref } from "@/lib/search";
import { common } from "@/messages/common";
import { compare as t } from "@/messages/compare";
import { listing } from "@/messages/listing";
import { trade } from "@/messages/trade";
import type { CartItem } from "@/types/cart";
import type { ListingDetail } from "@/types/listing";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: CartItem[]; details: ListingDetail[]; skipped: boolean };

const p = trade.purchase;
const outline = "h-8 px-2.5 rounded-md border text-[13px] font-medium disabled:opacity-40 disabled:pointer-events-none";

/**
 * 비교 (설계 2026-10-27 PR 3, 사용자 결정 2026-10-29). 검색 목록의 [비교]가 서버에 저장한 내 비교 목록을 읽어 나란히 보인다.
 * 매물은 상세 API 로 하나씩(1~4개), 열마다 [빼기]는 비교 행의 거래ID 로. 견적·구매 뒤엔 재고가 바뀌니 매물을 다시 읽는다.
 * 1개만 남아도 열과 [빼기]를 보인다(마지막 하나를 뺄 수 있게) — 위에 "2개 이상이어야 비교" 안내만 더한다
 */
export function CompareView() {
  const openTile = useTileOpen();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { notice, show, close: closeNotice } = useNotice();
  const [buying, setBuying] = useState<ListingDetail | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [quoting, setQuoting] = useState<QuoteTarget[] | null>(null);
  const [quoted, setQuoted] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const list = await cartApi.listCompare();
      if (!alive) return;
      if (!list.ok) {
        // 다시 읽기가 실패하면 보이던 표는 그대로 둔다 (처음 읽기만 오류 화면)
        setState((prev) => (prev.kind === "ready" ? prev : { kind: "error" }));
        return;
      }
      const items = list.data.items;
      const results = await Promise.all(items.map((i) => listingsApi.get(i.listing.userId, i.listing.regDate)));
      if (!alive) return;
      // 그새 지워진 매물만 빼고, 다른 실패는 처음 읽기만 오류 화면
      if (results.some((res) => !res.ok && res.code !== "LISTING_NOT_FOUND")) {
        setState((prev) => (prev.kind === "ready" ? prev : { kind: "error" }));
        return;
      }
      const details = results.flatMap((res) => (res.ok ? [res.data] : []));
      setState({ kind: "ready", items, details, skipped: details.length < results.length });
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (state.kind === "loading") return <div className="h-96 rounded-md bg-line-2 animate-pulse" aria-busy="true" />;
  if (state.kind === "error") {
    return (
      <Message
        text={t.page.loadFailed}
        action={t.page.retry}
        onAction={() => {
          setState({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const { details, items } = state;
  if (details.length === 0) return <Message text={t.page.empty} action={t.page.toSearch} onAction={() => openTile("/search", false)} />;
  // 서버가 같은 소분류만 저장하지만, 그새 매물 카테고리가 바뀌었을 수 있어 방어한다
  if (new Set(details.map((d) => d.category)).size > 1) {
    return <Message text={t.otherCategory} action={t.page.toSearch} onAction={() => openTile("/search", false)} />;
  }

  const rows = compareRows(details);
  const shown = onlyDiff ? rows.filter((r) => r.differs) : rows;
  const tradeIdOf = (d: ListingDetail) => items.find((i) => sameKey(i.listing, d))?.tradeId ?? null;

  const remove = async (d: ListingDetail, tradeId: string) => {
    setRemoving(true);
    const res = await cartApi.removeCompare([tradeId]);
    setRemoving(false);
    if (!res.ok) {
      show({ tone: "error", title: common.notice.removeFailed, message: trade.errors[res.code] ?? res.message });
      return;
    }
    // 빼기는 열만 줄이고 다시 읽지 않는다 (남은 열의 값은 그대로)
    setState((prev) =>
      prev.kind === "ready"
        ? { ...prev, items: prev.items.filter((i) => i.tradeId !== tradeId), details: prev.details.filter((x) => !sameKey(x, d)) }
        : prev,
    );
  };
  // 견적·구매는 서버가 그 매물의 장바구니 행을 바꾼다(비교 행은 그대로). 재고도 바뀌니 매물까지 다시 읽는다
  const traded = () => {
    notifyCartChanged();
    setAttempt((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-h-8.5">
        <p className="grow text-sm font-bold text-ink">{t.page.count(details.length)}</p>
        <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
          <Checkbox checked={onlyDiff} onCheckedChange={(v) => setOnlyDiff(v === true)} />
          {t.page.onlyDiff}
        </label>
      </div>
      {details.length < MIN_COMPARE && (
        <p role="status" className="text-[13px] text-ink-2">
          {t.page.tooFew}
        </p>
      )}
      {state.skipped && (
        <p role="status" className="text-[13px] text-ink-2">
          {t.page.removedSkipped}
        </p>
      )}
      <NoticeDialog notice={notice} onClose={closeNotice} />

      {/* 항목 열은 왼쪽에 고정, 상품 열이 넘치면 가로 스크롤 (좁은 칸·모바일) */}
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="align-top">
              <th scope="col" className="sticky left-0 z-10 w-24 @md:w-32 bg-surface p-3 text-left text-[13px] font-medium text-ink-2 border-b border-r border-line-2">
                {t.page.item}
              </th>
              {details.map((d) => {
                const tradeId = tradeIdOf(d);
                const done = d.tradeStatus === "completed";
                const photo = mainPhoto(d);
                return (
                  <th key={`${d.userId}/${d.regDate}`} scope="col" className="min-w-44 p-3 text-left font-normal border-b border-line-2">
                    <div className="flex flex-col gap-2">
                      {photo ? (
                        // API 서버의 공개 파일이라 next/image 원격 설정 없이 <img> (ListingSummaryCard 와 같은 이유)
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(photo)} alt={d.prodName} className="w-full h-28 object-contain rounded-md bg-bg" />
                      ) : (
                        <div className="h-28 rounded-md bg-bg flex items-center justify-center">
                          <Icon name="image" size={28} className="text-ink-3" aria-hidden={false} aria-label={listing.detail.noPhoto} role="img" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => openTile(listingHref(d), false)}
                        aria-label={t.page.detailAria(d.prodName)}
                        className="text-left text-[15px] font-bold text-ink hover:text-primary hover:underline break-words"
                      >
                        {d.prodName}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                        {d.prodNo && <span className="num">{d.prodNo}</span>}
                        {done && (
                          <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] bg-line-2 text-ink-2 text-[11px] font-semibold">
                            {listing.detail.completedBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {/* 거래완료는 서버가 막는다(409) — 버튼을 숨겨 빼기만 남긴다 */}
                        {!done && (
                          <>
                            <button
                              type="button"
                              onClick={() => setQuoting([{ sellerId: d.userId, regDate: d.regDate }])}
                              className={`${outline} border-primary text-primary hover:bg-primary-soft`}
                            >
                              {listing.detail.quote}
                            </button>
                            <button
                              type="button"
                              onClick={() => setBuying(d)}
                              className="h-8 px-3 rounded-md bg-primary text-white text-[13px] font-bold hover:bg-primary-dark"
                            >
                              {listing.detail.buy}
                            </button>
                          </>
                        )}
                        {tradeId && (
                          <button
                            type="button"
                            disabled={removing}
                            onClick={() => void remove(d, tradeId)}
                            aria-label={t.page.removeAria(d.prodName)}
                            className={`${outline} border-line text-ink-2 hover:bg-bg`}
                          >
                            {t.page.remove}
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={details.length + 1} className="p-6 text-center text-ink-3">
                  {t.page.noDiff}
                </td>
              </tr>
            )}
            {shown.map((row) => (
              <tr key={row.key} className={row.differs ? "bg-primary-soft/50" : ""}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 px-3 py-2 text-left text-[13px] border-b border-r border-line-2 ${row.differs ? "bg-primary-soft font-bold text-ink" : "bg-surface font-medium text-ink-2"}`}
                >
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2 align-top border-b border-line-2 break-words ${value === listing.detail.empty ? "text-ink-3" : "text-ink"} ${row.mono ? "num" : ""} ${row.long ? "whitespace-pre-line" : ""}`}
                  >
                    {value}
                    {row.best.has(i) && row.badge && (
                      <span className="ml-1.5 inline-flex items-center h-5 px-1.5 rounded-[5px] bg-green-soft text-green text-[11px] font-semibold align-middle">
                        {row.badge}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {buying && (
        <PurchaseDialog
          sellerId={buying.userId}
          regDate={buying.regDate}
          open
          onOpenChange={(open) => !open && setBuying(null)}
          onPurchased={() => {
            traded();
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
            traded();
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
    </div>
  );
}

function Message({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      <p className="text-[15px] font-bold text-ink">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
      >
        {action}
      </button>
    </div>
  );
}
