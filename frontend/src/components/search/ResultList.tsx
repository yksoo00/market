"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";
import { useCompareAdd } from "@/components/cart/useCompareAdd";
import { Icon } from "@/components/common/Icon";
import { NoticeDialog, useNotice } from "@/components/common/NoticeDialog";
import { ResultDialog } from "@/components/common/ResultDialog";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { SelectionBar } from "@/components/search/SelectionBar";
import { CartDialog, type CartTarget } from "@/components/trade/CartDialog";
import { PurchaseDialog } from "@/components/trade/PurchaseDialog";
import { QuoteDialog, type QuoteTarget } from "@/components/trade/QuoteDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { notifyCartChanged } from "@/lib/cart";
import { leafCategoryName } from "@/lib/categories";
import { compareBlock, MAX_COMPARE } from "@/lib/compare";
import { formatPrice } from "@/lib/format";
import { formatRegDate } from "@/lib/listingDetail";
import { selection, selectionKey, useSelection } from "@/lib/selection";
import { pendingLabel, salesHref } from "@/lib/tradeCounts";
import { MAX_CART_ADD } from "@/lib/validation/cart";
import { MAX_QUOTE_ITEMS } from "@/lib/validation/quote";
import { activeFilterCount, buildSearchHref, clearFilters, listingHref, type SearchQuery, type SearchScope } from "@/lib/search";
import { cart } from "@/messages/cart";
import { common } from "@/messages/common";
import { compare } from "@/messages/compare";
import { my } from "@/messages/my";
import { search as t } from "@/messages/search";
import { trade } from "@/messages/trade";
import type { CartAddResult } from "@/types/cart";
import type { ListingSearchItem } from "@/types/listing";
import type { PendingCounts } from "@/types/trade";

const r = t.result;
const p = trade.purchase;
const keyOf = (i: ListingSearchItem) => selectionKey(i);
const uniqueByListing = (items: ListingSearchItem[]) => [...new Map(items.map((i) => [selectionKey(i), i])).values()];

const qty = new Intl.NumberFormat("ko-KR");
// 체크박스·링크 클릭이 행 클릭(상세 이동)으로 번지지 않게
const stop = (e: MouseEvent) => e.stopPropagation();
const DASH = "–";

interface Column {
  label: string;
  /** Tailwind 폭 클래스 */
  width: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  strong?: boolean;
  /** 거래 중 행에서 보조 글자색 */
  muted?: boolean;
  /** 말줄임되는 칸의 전체 값 (마우스 올리면) */
  title?: (item: ListingSearchItem) => string | undefined;
  /** 칸 안의 버튼이 줄 이동(go)을 일으키지 않게 클릭을 막는다 */
  interactive?: boolean;
  cell: (item: ListingSearchItem, done: boolean) => ReactNode;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;
const c = t.columns;

// 검색·내 판매의 열 (체크·상품명은 왼쪽 고정). 사용자 지시 2026-10-30: 상품명·제조사·단가·수량·상품상태·카테고리·
// 최소 주문 수량·주문단위·납기일·등록일. 거래상태 칸은 두지 않는다(기본 검색이 거래 가능만 보여 준다)
const listColumns: Column[] = [
  { label: c.brand, width: "w-32", title: (i) => i.prodBrand, cell: (i) => i.prodBrand },
  { label: c.price, width: "w-28", align: "right", mono: true, strong: true, cell: (i) => formatPrice(i.salesUnitPrice) },
  { label: c.quantity, width: "w-20", align: "right", mono: true, cell: (i) => (i.stockQuantity === null ? DASH : qty.format(i.stockQuantity)) },
  { label: c.state, width: "w-26", cell: (i, done) => (done ? <CompletedBadge /> : i.prodState) },
  { label: c.category, width: "w-56", title: (i) => i.categoryPath ?? i.category, cell: (i) => (i.categoryPath ? leafCategoryName(i.categoryPath) : i.category) },
  { label: c.minOrder, width: "w-28", align: "right", mono: true, cell: (i) => (i.minOrderQuantity === null ? DASH : qty.format(i.minOrderQuantity)) },
  { label: c.orderUnit, width: "w-22", align: "right", mono: true, cell: (i) => (i.orderUnit === null ? DASH : qty.format(i.orderUnit)) },
  { label: c.deliveryDate, width: "w-26", mono: true, muted: true, cell: (i) => i.deliveryDate ?? DASH },
  { label: c.regDate, width: "w-26", mono: true, muted: true, cell: (i) => formatRegDate(i.regDate).slice(0, 10) },
];

interface Props {
  items: ListingSearchItem[];
  query: SearchQuery;
  /** 같은 조건의 전체 개수. items 는 [더 보기]로 받은 만큼만 */
  total: number;
  /** mine = 내 판매글 모드: 선택·견적·구매 없이 행마다 [수정] */
  scope?: SearchScope;
  /** mine 모드: 매물별 구매요청 건수 (GET /api/v1/trades/pending-counts). 아직 모르면 null */
  pendingCounts?: PendingCounts | null;
  /** 구매요청 성공 — 목록이 그 매물 행을 다시 읽게 */
  onPurchased?: (key: { userId: string; regDate: string }) => void;
}

// 선택 상태는 결과 집합마다 새로 시작한다 — 페이지에서 key={buildSearchHref(query)}로 다시 마운트
export function ResultList({ items, query, total, scope = "search", pendingCounts = null, onPurchased }: Props) {
  const openTile = useTileOpen();
  const mine = scope === "mine";
  const columns: Column[] = listColumns;
  // "구매요청 N건" → 받은 구매요청을 그 매물로 걸러 연다. 같은 판매 그룹이라 옆 칸에 반반으로
  const pendingLink = (item: ListingSearchItem) => {
    const label = pendingLabel(pendingCounts, item.regDate);
    if (!label) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          openTile(salesHref(item.regDate), false);
        }}
        aria-label={trade.pending.aria(item.prodName, pendingCounts?.[item.regDate] ?? 0)}
        className="inline-flex h-7 px-2 items-center rounded-md bg-primary-soft text-primary text-[12px] font-semibold hover:underline"
      >
        {label}
      </button>
    );
  };
  // 검색 목록의 선택은 모듈 저장소(lib/selection)에 둔다 — 검색어·필터를 바꿔 목록이 다시 만들어져도 남고, 목록 위 "선택한 상품" 줄이 보여 준다.
  // 장바구니 화면은 다른 칸에서 바뀌면 표를 새로 그리지 않고 줄만 바꾸므로 자기 상태로 두고, 사라진 줄의 선택은 걸러 센다
  const shared = scope === "search";
  const stored = useSelection();
  const [local, setLocal] = useState<ReadonlySet<string>>(new Set());
  const picked: ReadonlySet<string> = shared ? new Set(stored.keys()) : new Set(items.map(keyOf).filter((k) => local.has(k)));
  const visiblePicked = items.filter((i) => picked.has(keyOf(i))).length;
  // 클릭 뒤 안내는 모달로 (사용자 지시 2026-10-30)
  const { notice, show, close: closeNotice } = useNotice();
  // [구매] 모달 대상(체크한 매물 1개)과 성공 안내
  const [buying, setBuying] = useState<ListingSearchItem | null>(null);
  const [purchased, setPurchased] = useState(false);
  // [견적 요청] 모달 대상(체크한 매물 1~20개)과 성공 안내
  const [quoting, setQuoting] = useState<QuoteTarget[] | null>(null);
  const [quoted, setQuoted] = useState(false);
  // [장바구니] 담기 모달 대상(체크한 매물 1~20개)과 성공 안내
  const [cartTargets, setCartTargets] = useState<CartTarget[] | null>(null);
  const [added, setAdded] = useState<CartAddResult | null>(null);
  // [비교에 담기] — 4개 초과·소분류 섞임 모달과 성공 안내까지 공용 훅이 그린다 (2026-11-03)
  const compareAdd = useCompareAdd();

  const toggle = (item: ListingSearchItem) => {
    if (shared) {
      selection.toggle(item);
      return;
    }
    const key = keyOf(item);
    setLocal((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const allChecked = items.length > 0 && visiblePicked === items.length;
  const headerChecked = allChecked ? true : visiblePicked > 0 ? "indeterminate" : false;
  const toggleAll = () => {
    if (shared) {
      if (allChecked) selection.removeAll(items);
      else selection.addAll(items);
    } else {
      setLocal(allChecked ? new Set() : new Set(items.map(keyOf)));
    }
  };
  // 체크한 매물. 검색은 목록에 안 보이는 것까지(저장소), 장바구니는 지금 줄 중에서
  const chosenItems = (): ListingSearchItem[] => (shared ? [...stored.values()] : items.filter((i) => picked.has(keyOf(i))));
  const showNotice = (title: string, message: string) => show({ tone: "error", title, message });
  // 견적은 여러 매물을 한 번에 (서버 한도 20개)
  const quoteSelected = () => {
    const chosen = chosenItems();
    if (chosen.length === 0) return;
    // 같은 상품이 여러 줄이어도 견적은 매물당 한 건이다
    if (uniqueByListing(chosen).length < chosen.length) showNotice(common.notice.quoteBlocked, trade.quote.sameListing);
    else if (chosen.length > MAX_QUOTE_ITEMS) showNotice(common.notice.quoteBlocked, trade.quote.tooMany(MAX_QUOTE_ITEMS));
    else setQuoting(chosen.map((i) => ({ sellerId: i.userId, regDate: i.regDate })));
  };
  // 장바구니는 수량·납품희망일·요청사항을 받는 모달로 담는다 (서버 한도 20개). 하나라도 틀리면 서버가 아무것도 안 담고 이유를 돌려준다
  const addSelected = () => {
    const chosen = chosenItems();
    if (chosen.length > MAX_CART_ADD) {
      showNotice(common.notice.cartBlocked, cart.add.tooMany(MAX_CART_ADD));
      return;
    }
    setCartTargets(chosen.map((i) => ({ sellerId: i.userId, regDate: i.regDate })));
  };
  // 구매 모달은 매물 1개용 — 여러 개를 체크했으면 하나만 고르라고 알린다 (계획 2026-10-15 "스펙과 달라진 점")
  const buySelected = () => {
    const chosen = chosenItems();
    if (chosen.length === 1) setBuying(chosen[0]);
    else if (chosen.length > 1) showNotice(common.notice.buyBlocked, p.oneAtATime);
  };
  // 비교는 쌓인다 (사용자 결정 2026-11-03). 이번에 고른 것만 4개·같은 소분류를 미리 보고, 이미 담긴 것과 합친 검사는 서버가 한다 —
  // 막히면 [비우고 새로 담기] 모달. 거래완료도 볼 수 있어 거르지 않는다 (비교 화면이 버튼만 숨김)
  const compareSelected = () => {
    // 같은 상품이 여러 줄이어도 비교는 상품 단위다
    const chosen = uniqueByListing(chosenItems());
    const block = compareBlock(chosen);
    if (block === "tooMany") showNotice(common.notice.compareBlocked, compare.tooMany(MAX_COMPARE));
    else if (block === "category") showNotice(common.notice.compareBlocked, compare.otherCategory);
    else void compareAdd.add(chosen.map((i) => ({ sellerId: i.userId, regDate: i.regDate })));
  };
  const selectionBar = shared ? (
    <SelectionBar items={[...stored.values()]} onRemove={(key) => selection.remove(key)} onClear={() => selection.clear()} />
  ) : null;
  // router.push 는 타일 큐를 안 거쳐, iframe 칸에서 누르면 그 칸이 닫히고 2분할이 된다. 이름 링크와 같은 규칙(칸 규칙)으로 연다.
  // 내 판매글도 검색처럼 상세를 보조 칸에 연다 — 전체 화면(reset)으로 열던 예외는 이 화면만 2분할이 돼 뺐다 (decisions.md 2026-10-19)
  const go = (item: ListingSearchItem) => openTile(listingHref(item), false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        {selectionBar}
        <Empty query={query} scope={scope} />
      </div>
    );
  }

  const actions = (size: string) => (
    <>
      {scope === "search" && (
        <button
          type="button"
          disabled={picked.size === 0 || compareAdd.busy}
          onClick={compareSelected}
          className={`${size} px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none`}
        >
          {compare.button}
        </button>
      )}
      {scope === "search" && (
        <button
          type="button"
          disabled={picked.size === 0}
          onClick={addSelected}
          className={`${size} px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none`}
        >
          {cart.add.button}
        </button>
      )}
      <button
        type="button"
        disabled={picked.size === 0}
        onClick={quoteSelected}
        className={`${size} px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none`}
      >
        {r.quote}
      </button>
      <button
        type="button"
        disabled={picked.size === 0}
        onClick={buySelected}
        className={`${size} px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none`}
      >
        {r.buy}
      </button>
    </>
  );

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 min-h-8.5">
        {!mine && (
          <Checkbox
            className="@min-[36rem]:hidden"
            checked={headerChecked}
            onCheckedChange={toggleAll}
            aria-label={r.selectAll}
          />
        )}
        <p className="grow text-sm text-ink-2" aria-live="polite">
          <span className="font-bold text-ink">{r.count(total)}</span>
          {picked.size > 0 && r.selected(picked.size)}
        </p>
        {!mine && <div className="hidden @min-[36rem]:flex gap-2">{actions("h-8.5")}</div>}
      </div>

      {selectionBar}

      {!mine && buying && (
        <PurchaseDialog
          sellerId={buying.userId}
          regDate={buying.regDate}
          open
          onOpenChange={(open) => !open && setBuying(null)}
          onPurchased={() => {
            // 서버가 그 매물을 장바구니에서 지웠다 (어디서 샀든) — 헤더 숫자를 맞춘다
            notifyCartChanged();
            setPurchased(true);
            onPurchased?.({ userId: buying.userId, regDate: buying.regDate });
          }}
        />
      )}
      {!mine && cartTargets && (
        <CartDialog
          targets={cartTargets}
          open
          onOpenChange={(open) => !open && setCartTargets(null)}
          onAdded={(result) => {
            notifyCartChanged();
            setAdded(result);
          }}
        />
      )}
      {!mine && quoting && (
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
      <ResultDialog
        open={added !== null}
        tone="success"
        title={cart.add.doneTitle}
        message={cart.add.doneMessage}
        actionLabel={cart.add.toCart}
        onAction={() => {
          setAdded(null);
          openTile("/my/cart", false);
        }}
        onClose={() => setAdded(null)}
      />

      {!mine && <NoticeDialog notice={notice} onClose={closeNotice} />}
      {compareAdd.dialogs}

      {/* 데스크톱: 표. 열이 많아(16) 칸에 다 안 들어가므로 가로 스크롤하고, 체크·상품명은 왼쪽에 고정해
          어느 열을 보든 어떤 매물인지 보이게 한다.
          표↔카드 기준은 @md(768)가 아니라 칸 폭 576 — 타일 반반 분할이면 칸이 768 미만(1440 창이면 720)이라
          카드로 줄어들었다. 분할에서도 표가 옆으로 펼쳐져야 한다 (사용자 지시). 폰(390)은 그대로 카드 */}
      <div className="hidden @min-[36rem]:block rounded-md border border-line bg-surface overflow-x-auto">
        <table className={`w-full ${mine ? "min-w-334" : "min-w-322"} table-fixed text-[13px]`}>
          <colgroup>
            {!mine && <col className="w-10" />}
            <col className="w-48" />
            {columns.map((c) => (
              <col key={c.label} className={c.width} />
            ))}
            {mine && <col className="w-22" />}
          </colgroup>
          <thead className="bg-bg text-xs text-ink-2">
            <tr className="h-10 text-left">
              {!mine && (
                <th scope="col" className="sticky left-0 z-10 bg-bg pl-3">
                  <Checkbox checked={headerChecked} onCheckedChange={toggleAll} aria-label={r.selectAll} />
                </th>
              )}
              <th scope="col" className={`sticky ${mine ? "left-0 pl-3" : "left-10"} z-10 bg-bg px-2 font-medium border-r border-line-2`}>
                {t.columns.prodName}
              </th>
              {columns.map((c, i) => (
                <th key={c.label} scope="col" className={`px-2 font-medium ${alignClass[c.align ?? "left"]} ${i === columns.length - 1 ? "pr-3" : ""}`}>
                  {c.label}
                </th>
              ))}
              {mine && (
                <th scope="col" className="px-2 font-medium text-center">
                  {trade.pending.column}
                </th>
              )}
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
                  className={`group h-11 border-t border-line-2 cursor-pointer hover:bg-bg ${done ? "text-ink-3" : "text-ink"}`}
                >
                  {!mine && (
                    <td className="sticky left-0 z-10 bg-surface group-hover:bg-bg pl-3" onClick={stop}>
                      <Checkbox checked={picked.has(key)} onCheckedChange={() => toggle(item)} aria-label={r.selectRow(item.prodName)} />
                    </td>
                  )}
                  <td className={`sticky ${mine ? "left-0 pl-3" : "left-10"} z-10 bg-surface group-hover:bg-bg px-2 truncate font-medium border-r border-line-2`} title={item.prodName}>
                    <Link href={listingHref(item)} onClick={stop} className="hover:text-primary">
                      {item.prodName}
                    </Link>
                  </td>
                  {columns.map((c, i) => (
                    <td
                      key={c.label}
                      title={c.title?.(item)}
                      onClick={c.interactive ? stop : undefined}
                      className={`px-2 truncate ${alignClass[c.align ?? "left"]} ${c.mono ? "num" : ""} ${c.strong ? "font-semibold" : ""} ${c.muted && !done ? "text-ink-2" : ""} ${i === columns.length - 1 ? "pr-3" : ""}`}
                    >
                      {c.cell(item, done)}
                    </td>
                  ))}
                  {mine && (
                    <td className="px-2 text-center" onClick={stop}>
                      {pendingLink(item) ?? DASH}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 행 카드 */}
      <ul className="@min-[36rem]:hidden rounded-md border border-line bg-surface">
        {items.map((item, idx) => {
          const key = keyOf(item);
          const done = item.tradeStatus === "completed";
          return (
            <li
              key={key}
              onClick={() => go(item)}
              className={`flex gap-3 px-3 py-3 cursor-pointer ${idx > 0 ? "border-t border-line-2" : ""} ${done ? "text-ink-3" : "text-ink"}`}
            >
              {!mine && (
                <div className="pt-0.5" onClick={stop}>
                  <Checkbox checked={picked.has(key)} onCheckedChange={() => toggle(item)} aria-label={r.selectRow(item.prodName)} />
                </div>
              )}
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
                  <span className="num text-ink-2">{item.stockQuantity === null ? DASH : `${qty.format(item.stockQuantity)}${r.qtyUnit}`}</span>
                  <span className="num font-semibold">{formatPrice(item.salesUnitPrice)}</span>
                  <span className="ml-auto flex gap-1.5">
                    <Has on={item.hasDataSheet} icon="file" label={r.dataSheet} />
                    <Has on={item.hasPhoto} icon="image" label={r.photo} />
                  </span>
                </div>
                <ExtraChips item={item} />
                {mine && pendingLink(item)}
              </div>
            </li>
          );
        })}
      </ul>

      {/* 모바일: 선택하면 아래(탭바 위)에 고정. main 이 스크롤 칸이라 sticky 로 칸 바닥에 붙는다 */}
      {!mine && picked.size > 0 && (
        <div className="@min-[36rem]:hidden sticky bottom-0 -mx-4 px-4 py-2.5 flex gap-2 bg-surface border-t border-line [&>button]:flex-1">
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

// 모바일 카드엔 표의 보증·서류 열 대신, 있는 것만 칩으로 (대부분 비어 있어 줄이 안 생기는 경우가 많다)
function ExtraChips({ item }: { item: ListingSearchItem }) {
  const chips = [
    item.warrantyUntil && r.warrantyChip(item.warrantyUntil),
    item.warrantyCoverage,
    item.hasReplaceProd && c.replaceProd,
    item.hasTestReport && c.testReport,
    item.hasCertificate && c.certificate,
  ].filter((s): s is string => typeof s === "string" && s !== "");
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {chips.map((s) => (
        <li key={s} className="h-5 px-1.5 inline-flex items-center rounded-[5px] bg-primary-soft text-primary-dark text-[11px] font-medium">
          {s}
        </li>
      ))}
    </ul>
  );
}

// 유무만 보이는 열(제조일·상품설명·대체품·테스트리포트·정품인증서). 요구 화면대로 O / X
function CompletedBadge() {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] bg-line-2 text-ink-2 text-[11px] font-semibold">
      {r.completedBadge}
    </span>
  );
}

function Empty({ query, scope }: { query: SearchQuery; scope: SearchScope }) {
  const filtered = activeFilterCount(query, scope) > 0;
  // 내 글이 하나도 없을 때(검색어·필터 없음)만 "등록하러 가기", 조건 때문에 비면 일반 빈 상태
  const noneYet = scope === "mine" && !filtered && query.q === "";
  return (
    <div className="py-16 flex flex-col items-center gap-2 text-center">
      <p className="text-[15px] font-bold text-ink">{noneYet ? my.mine.emptyTitle : t.empty.title}</p>
      {noneYet ? (
        <Link href="/listings/new" className="text-[13px] text-primary font-medium hover:underline">
          {my.mine.emptyAction}
        </Link>
      ) : filtered ? (
        <Link href={buildSearchHref(clearFilters(query, scope), scope)} className="text-[13px] text-primary font-medium hover:underline">
          {t.empty.reset}
        </Link>
      ) : (
        <p className="text-[13px] text-ink-2">{t.empty.tryOther}</p>
      )}
    </div>
  );
}
