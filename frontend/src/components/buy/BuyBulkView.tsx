"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type DragEvent } from "react";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { BuyBulkRows } from "@/components/buy/BuyBulkRows";
import { ProductSearchDialog } from "@/components/listing/ProductSearchDialog";
import { cartBulkApi } from "@/lib/api/cartBulk";
import { buyReducer, canSelect, initialBuyState, markDuplicates, summary, toCheckRow, toCommitRow, type BuyAction, type BuyLine, type BuyPick, type BuyState } from "@/lib/buyBulk";
import { initialBuyView, tabCounts, visibleLines, type BuySortKey, type BuyTab, type BuyView } from "@/lib/buyBulkView";
import { clearBuyBulk, loadBuyBulk, saveBuyBulk } from "@/lib/buyBulkStorage";
import { todayInSeoul } from "@/lib/listingForm";
import { cn } from "@/lib/utils";
import { isXlsx } from "@/lib/validation/bulkListing";
import type { BuyFields } from "@/lib/validation/buyBulk";
import { checkUpload } from "@/lib/validation/upload";
import { buyBulk } from "@/messages/buyBulk";
import { UNREACHABLE } from "@/types/api";
import type { ProductSearchItem } from "@/types/listing";

const t = buyBulk;

const TABS: BuyTab[] = ["all", "choose", "available", "unavailable", "failed", "done"];
const SORT_KEYS: BuySortKey[] = ["rowNo", "prodName", "prodBrand", "orderQuantity", "unitPrice", "status"];

const buttonClass = "h-8 px-3 rounded-md border border-line text-[13px] font-medium text-ink-2 hover:bg-bg disabled:opacity-40";

/** 남은 일이 없으면(전부 담김) 보관본을 비우고, 아니면 저장한다 */
function persist(state: BuyState): void {
  if (state.lines.length > 0 && state.lines.every((l) => l.added)) clearBuyBulk();
  else saveBuyBulk(state);
}

/**
 * 엑셀 대량구매 페이지 (계획 2026-11-09-bulk-purchase-excel.md). 서버는 줄 상태를 저장하지 않는다 — 수정·체크는 여기(buyReducer)에 있고
 * sessionStorage 에 보관되며, 검사·담기 때마다 줄을 전부 다시 보낸다. 필터·검색·정렬(buyBulkView)은 전부 브라우저에서 한다.
 * 담기는 장바구니까지 — 구매·견적은 기존 장바구니 화면에서 한다
 */
export function BuyBulkView() {
  // 새로고침해도 이어서 하게 보관본으로 시작한다. 로그인 확인(RequireLogin)이 끝난 뒤에 그려져 서버 렌더와 어긋나지 않는다.
  // 보관해 둔 결과(재고·단가·고른 매물)는 낡았을 수 있어 선택은 풀어 두고, [다시 맞춰 보기]로 다시 확인한 뒤 고르게 한다
  const [state, dispatch] = useReducer(buyReducer, initialBuyState, () => {
    const stored = loadBuyBulk();
    return stored ? markDuplicates({ ...stored, lines: stored.lines.map((l) => ({ ...l, selected: false })) }) : initialBuyState;
  });
  const [restored, setRestored] = useState(() => state.lines.length > 0);
  // 새 파일을 읽거나 처음부터 다시 하면 올린다 — 보이는 줄 목록을 이때만 다시 짠다 (아래 visibleNos)
  const [loadId, setLoadId] = useState(0);
  const [view, setView] = useState<BuyView>(initialBuyView);
  const [step, setStep] = useState<"idle" | "reading">("idle");
  const [pickError, setPickError] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [finder, setFinder] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // 마지막 검사 뒤에 고친 줄. 칸을 벗어날 때 이 줄만 서버에 다시 묻는다
  const edited = useRef(new Set<number>());
  // 줄마다 마지막으로 보낸 검사 번호 — 먼저 보낸 요청의 응답이 늦게 와 새 결과를 덮어쓰지 않게, 번호가 다르면 그 응답은 버린다
  const sent = useRef(new Map<number, number>());
  const seq = useRef(0);
  const openTile = useTileOpen();
  const today = todayInSeoul();

  // 줄이 바뀌면 보관한다. 글자를 칠 때마다 줄 전체를 다시 쓰지 않게 잠깐 모아서 쓰고, 떠나거나 새로고침할 때는 마저 쓴다
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    const timer = setTimeout(() => persist(state), 250);
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    const flush = () => persist(latest.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const stat = useMemo(() => summary(state.lines), [state.lines]);
  const counts = useMemo(() => tabCounts(state.lines), [state.lines]);
  const committable = useMemo(() => state.lines.filter(canSelect).length, [state.lines]);
  // 보이는 줄은 탭·검색·정렬을 바꾸거나 새 파일을 읽거나 담았을 때만 다시 짠다. 칸을 고칠 때마다 다시 짜면 오류가 풀린 줄이 탭에서 빠져
  // 입력 칸이 사라진다(칸을 벗어남 검사도 안 돈다). 고친 줄은 다른 탭을 누르기 전까지 그 자리에 있다 — 개수만 바로 바뀐다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleNos = useMemo(() => visibleLines(state.lines, view).map((l) => l.rowNo), [view, loadId, state.added]);
  const byRow = new Map(state.lines.map((l) => [l.rowNo, l]));
  const shown = visibleNos.flatMap((n) => byRow.get(n) ?? []);
  const hasOpen = state.lines.some((l) => !l.added);
  const busy = committing || step === "reading";

  // 줄을 서버에 다시 물어본다. base 는 방금 낸 수정이 이미 들어간 상태 (이 렌더의 state 에는 아직 없으므로 호출한 쪽이 리듀서로 먼저 계산).
  // 응답 전엔 그 줄을 체크할 수 없다 (checking). 네트워크 실패면 이전 결과를 그대로 두고 체크만 풀린 채 둔다 — 칸을 다시 벗어나면 재시도
  const recheckRows = async (base: BuyState, rowNos: number[]) => {
    const wanted = new Set(rowNos);
    const lines = base.lines.filter((l) => wanted.has(l.rowNo) && !l.added);
    if (lines.length === 0) return true;
    const token = ++seq.current;
    lines.forEach((l) => {
      sent.current.set(l.rowNo, token);
      dispatch({ type: "checking", rowNo: l.rowNo });
    });
    const res = await cartBulkApi.check(lines.map(toCheckRow));
    const fresh = new Set(lines.filter((l) => sent.current.get(l.rowNo) === token).map((l) => l.rowNo));
    const results = res.ok ? res.data.results : lines.map((l) => l.result);
    dispatch({ type: "rechecked", results: results.filter((r) => fresh.has(r.rowNo)), cartCount: res.ok ? res.data.cartCount : undefined });
    if (!res.ok) setTopError(res.fields ? Object.values(res.fields).join(" ") : (t.errors[res.code] ?? res.message));
    return res.ok;
  };

  // 글자를 치는 칸이라 칠 때마다 묻지 않고, 칸을 벗어날 때 그 줄만 서버에 다시 묻는다
  const edit = (rowNo: number, field: keyof BuyFields, value: string) => {
    dispatch({ type: "edited", rowNo, field, value, today });
    edited.current.add(rowNo);
  };

  /** 고르는 칸(조건의 상태·보증·증빙)은 바꾼 즉시 서버에 다시 묻는다 — 칸을 벗어나는 순간이 따로 없어서 */
  const editNow = (rowNo: number, field: keyof BuyFields, value: string) => change({ type: "edited", rowNo, field, value, today }, rowNo);

  const blurLine = (rowNo: number) => {
    if (edited.current.delete(rowNo)) void recheckRows(state, [rowNo]);
  };

  /** 상태를 바꾸는 선택(상품 고르기·직접 입력·매물 고르기)은 바로 서버에 다시 묻는다 */
  const change = (action: BuyAction, rowNo: number) => {
    dispatch(action);
    void recheckRows(buyReducer(state, action), [rowNo]);
  };

  const pick = (rowNo: number, p: BuyPick) => change({ type: "picked", rowNo, pick: p }, rowNo);
  const unlock = (rowNo: number) => change({ type: "unlocked", rowNo }, rowNo);
  const choose = (rowNo: number, sellerId: string, regDate: string) => change({ type: "chose", rowNo, sellerId, regDate }, rowNo);

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setPickError(null);
    const error = !isXlsx(file) ? t.drop.notXlsx : checkUpload("excel", file);
    if (error) {
      setPickError(error);
      return;
    }
    if (hasOpen && !window.confirm(t.overwriteConfirm)) return;
    setStep("reading");
    const res = await cartBulkApi.parse(file);
    setStep("idle");
    if (!res.ok) {
      setPickError(res.fields?.file ?? (t.errors[res.code] ?? res.message ?? t.readFailed));
      return;
    }
    if (res.data.rows.length === 0) {
      setPickError(t.emptyFile);
      return;
    }
    edited.current.clear();
    sent.current.clear();
    setTopError(null);
    setRestored(false);
    setView(initialBuyView);
    setLoadId((n) => n + 1);
    dispatch({ type: "loaded", rows: res.data.rows, results: res.data.results, cartCount: res.data.cartCount, cartMax: res.data.cartMax });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 1) {
      setPickError(t.drop.onlyOne);
      return;
    }
    void upload(e.dataTransfer.files[0]);
  };

  const downloadTemplate = async () => {
    const res = await cartBulkApi.template();
    if (!res.ok) {
      setPickError(t.drop.templateFailed);
      return;
    }
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = t.drop.templateFile;
    // DOM 에 붙여 눌러야 브라우저가 받고, 주소는 내려받기가 시작된 뒤에 푼다 (바로 풀면 일부 브라우저가 빈 파일을 받는다)
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 선택해서 담기 = 체크한 줄, 모두 담기 = 담을 수 있는 줄 전부(필터로 숨은 줄 포함 — 확인 문구에 개수)
  const commit = async (lines: BuyLine[]) => {
    if (lines.length === 0 || busy) return;
    const rows = lines.map(toCommitRow);
    // 필터·검색으로 지금 안 보이는데 담기에 들어가는 줄 — 선택한 뒤 탭을 옮긴 경우에도 있을 수 있다
    const visible = new Set(visibleNos);
    const hidden = lines.filter((l) => !visible.has(l.rowNo)).length;
    const mismatched = lines.filter((l) => (l.result.chosen?.mismatches.length ?? 0) > 0).length;
    if (!window.confirm(t.confirm(rows.length, hidden, mismatched))) return;
    setCommitting(true);
    setTopError(null);
    const res = await cartBulkApi.commit(rows);
    setCommitting(false);
    if (!res.ok) {
      // 요청이 끝까지 가지 못했으면(네트워크·서버 오류) 일부는 이미 담겼을 수 있다 — 장바구니를 먼저 보게 한다
      setTopError(res.code === UNREACHABLE ? t.commitUnknown : (t.errors[res.code] ?? res.message));
      return;
    }
    dispatch({ type: "committed", outcomes: res.data.results, cartCount: res.data.cartCount });
    const failedCount = res.data.results.filter((o) => !o.ok).length;
    if (failedCount > 0) setTopError(t.commitFailedSome(failedCount));
  };

  const commitSelected = () => void commit(state.lines.filter((l) => l.selected && !l.added));
  const commitAll = () => void commit(state.lines.filter(canSelect));

  const reset = () => {
    if (hasOpen && !window.confirm(t.resetConfirm)) return;
    edited.current.clear();
    sent.current.clear();
    setTopError(null);
    setPickError(null);
    setRestored(false);
    setView(initialBuyView);
    setLoadId((n) => n + 1);
    dispatch({ type: "restored", state: initialBuyState });
    clearBuyBulk();
  };

  const compact = state.lines.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={t.drop.zone}
        aria-disabled={busy}
        onClick={() => !busy && fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line bg-surface px-4 text-center outline-none focus-visible:border-primary",
          compact ? "py-3" : "min-h-40 py-8",
          dragging && "border-primary bg-primary-soft",
          busy && "cursor-progress opacity-70",
        )}
      >
        {step === "reading" ? (
          <p aria-busy="true" className="text-[15px] font-bold text-ink">
            {t.reading}
          </p>
        ) : compact ? (
          <p className="text-[13px] text-ink-2">
            <span className="font-semibold text-primary">{t.drop.compact}</span> · {t.drop.hint}
          </p>
        ) : (
          <>
            <p className="text-[15px] font-bold text-ink">{t.drop.prompt}</p>
            <p className="text-[13px] text-ink-2">{t.drop.or}</p>
            <span className="h-9 px-4 inline-flex items-center rounded-md border border-primary text-[13px] font-bold text-primary">{t.drop.pick}</span>
            <p className="text-[12px] text-ink-3">{t.drop.hint}</p>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // 같은 파일을 다시 골라도 change 가 나게
          void upload(file);
        }}
      />
      {pickError && (
        <p role="alert" className="text-[13px] text-down">
          {pickError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void downloadTemplate()} className="text-[13px] font-medium text-primary underline underline-offset-2">
          {t.drop.template}
        </button>
        {compact && (
          <button type="button" onClick={reset} disabled={busy} className="text-[13px] font-medium text-ink-2 underline underline-offset-2 disabled:opacity-40">
            {t.reset}
          </button>
        )}
        {compact && <span className="num ml-auto text-[13px] text-ink-2">{t.cart(state.cartCount, state.cartMax)}</span>}
      </div>

      {restored && compact && (
        <div role="status" className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-ink-2">{t.restored}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRestored(false);
              void recheckRows(state, state.lines.filter((l) => !l.added).map((l) => l.rowNo));
            }}
            className={buttonClass}
          >
            {t.recheckAll}
          </button>
        </div>
      )}
      {state.added > 0 && (
        <div role="status" className="flex flex-col gap-1">
          <p className="text-[13px] font-semibold text-ink">
            {t.done(state.added)} {stat.available + stat.unavailable + stat.failed > 0 ? t.remaining(stat.available + stat.unavailable + stat.failed) : t.allDone}
          </p>
          <p className="text-[13px] text-ink-2">{t.doneHint}</p>
          <div>
            <button type="button" onClick={() => openTile("/my/cart", false)} className="h-8 px-3 rounded-md border border-primary text-[13px] font-bold text-primary hover:bg-primary-soft">
              {t.openCart}
            </button>
          </div>
        </div>
      )}
      {topError && (
        <p role="alert" className="text-[13px] text-down">
          {topError}
        </p>
      )}

      {/* 담는 중·읽는 중에는 칸 수정·체크를 막는다 — 보낸 뒤에 고친 값이 "담김"으로 표시돼 담기지 않은 값이 남는 일을 막는다 */}
      {compact && (
        <fieldset disabled={busy} className="contents">
          <div role="tablist" aria-label={t.title} className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={view.tab === tab}
                onClick={() => setView((v) => ({ ...v, tab }))}
                className={cn("shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium", view.tab === tab ? "border-primary font-bold text-primary" : "border-transparent text-ink-2 hover:text-ink")}
              >
                {t.tabs[tab]} <span className="num">{counts[tab]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={view.query}
              onChange={(e) => setView((v) => ({ ...v, query: e.target.value }))}
              aria-label={t.searchLabel}
              placeholder={t.searchPlaceholder}
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[13px] outline-none focus-visible:border-primary @md:max-w-xs @md:flex-none"
            />
            <span className="flex items-center gap-1">
              <select
                aria-label={t.sortLabel}
                value={view.sort?.key ?? "rowNo"}
                onChange={(e) => setView((v) => ({ ...v, sort: { key: e.target.value as BuySortKey, dir: v.sort?.dir ?? "asc" } }))}
                className="h-8 rounded-md border border-line bg-surface px-2 text-[13px]"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t.sortOptions[key]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setView((v) => ({ ...v, sort: { key: v.sort?.key ?? "rowNo", dir: v.sort?.dir === "desc" ? "asc" : "desc" } }))}
                aria-label={view.sort?.dir === "desc" ? t.sortDesc : t.sortAsc}
                className={buttonClass}
              >
                {view.sort?.dir === "desc" ? "▼" : "▲"}
              </button>
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => dispatch({ type: "selectVisible", rowNos: visibleNos, value: true })} className={buttonClass}>
                {t.selectVisible}
              </button>
              <button type="button" onClick={() => dispatch({ type: "selectVisible", rowNos: visibleNos, value: false })} className={buttonClass}>
                {t.clearVisible}
              </button>
            </span>
          </div>
          <p className="num text-[13px] text-ink-2">{t.summary(stat.choose, stat.available, stat.unavailable, stat.failed, stat.selected)}</p>

          {shown.length === 0 ? (
            <p className="rounded-md border border-line bg-surface py-10 text-center text-[14px] text-ink-2">{t.emptyView}</p>
          ) : (
            <BuyBulkRows
              // 새 파일이면 줄 번호가 같아도 조건 구역의 펼침 상태를 새로 정하게 다시 그린다
              key={loadId}
              lines={shown}
              onToggle={(rowNo) => dispatch({ type: "toggled", rowNo })}
              onEdit={edit}
              onEditNow={editNow}
              onBlurLine={blurLine}
              onPick={pick}
              onFind={setFinder}
              onUnlock={unlock}
              onChoose={choose}
            />
          )}

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-line bg-surface py-3">
            <button
              type="button"
              onClick={commitSelected}
              disabled={busy || stat.selected === 0}
              className="h-10 px-5 rounded-md bg-primary text-white text-[14px] font-bold hover:bg-primary-dark disabled:opacity-40"
            >
              {committing ? t.actions.committing : t.actions.commitSelected(stat.selected)}
            </button>
            <button
              type="button"
              onClick={commitAll}
              disabled={busy || committable === 0}
              className="h-10 px-5 rounded-md border border-primary text-primary text-[14px] font-bold hover:bg-primary-soft disabled:opacity-40"
            >
              {t.actions.commitAll(committable)}
            </button>
          </div>
        </fieldset>
      )}

      {finder !== null && (
        <ProductSearchDialog
          onClose={() => setFinder(null)}
          onPick={(item: ProductSearchItem) => {
            const rowNo = finder;
            setFinder(null);
            pick(rowNo, { prodId: item.prodId, prodName: item.prodName, prodBrand: item.prodBrand, prodClassNo: item.prodClassNo });
          }}
        />
      )}
    </div>
  );
}
