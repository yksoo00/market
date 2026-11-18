"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type DragEvent } from "react";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkHeader, BulkRows } from "@/components/listing/BulkRows";
import { CategoryPickDialog } from "@/components/listing/CategoryPickDialog";
import { ProductSearchDialog } from "@/components/listing/ProductSearchDialog";
import { listingBulkApi } from "@/lib/api/listings";
import { bulkReducer, canSelect, initialBulkState, summary, toApiRow, type BulkAction, type BulkLine, type BulkPick, type BulkState } from "@/lib/bulkListing";
import { initialBulkView, nextSortFor, tabCounts, visibleLines, type BulkSortKey, type BulkTab, type BulkView } from "@/lib/bulkListingView";
import { clearBulk, loadBulk, saveBulk } from "@/lib/bulkStorage";
import { todayInSeoul } from "@/lib/listingForm";
import { isXlsx, type BulkFields } from "@/lib/validation/bulkListing";
import { checkUpload } from "@/lib/validation/upload";
import { cn } from "@/lib/utils";
import { listing } from "@/messages/listing";
import type { ProductSearchItem } from "@/types/listing";

const t = listing.bulk;
const p = listing.bulk.page;

const TABS: BulkTab[] = ["all", "ok", "new", "failed", "done"];
const SORT_KEYS: BulkSortKey[] = ["rowNo", "prodName", "prodBrand", "salesUnitPrice", "salesQuantity", "status"];

/** 남은 일이 없으면(전부 등록됨) 보관본을 비우고, 아니면 저장한다 */
function persist(state: BulkState): void {
  if (state.lines.length > 0 && state.lines.every((l) => l.committed)) clearBulk();
  else saveBulk(state);
}

const buttonClass = "h-8 px-3 rounded-md border border-line text-[13px] font-medium text-ink-2 hover:bg-bg disabled:opacity-40";

/**
 * 엑셀 판매상품 다량 등록 페이지 (계획 2026-11-06-bulk-listing-page.md). 서버는 줄 상태를 저장하지 않는다 —
 * 수정·체크는 여기(bulkReducer)에 있고 sessionStorage 에 보관되며, 검사·확정 때마다 줄을 전부 다시 보낸다.
 * 필터·검색·정렬(bulkListingView)은 전부 브라우저에서 한다.
 */
export function BulkListingView() {
  // 새로고침해도 이어서 하게 보관본으로 시작한다. 로그인 확인(RequireLogin)이 끝난 뒤에 그려져 서버 렌더와 어긋나지 않는다
  const [state, dispatch] = useReducer(bulkReducer, initialBulkState, () => loadBulk() ?? initialBulkState);
  const [restored, setRestored] = useState(() => state.lines.length > 0);
  // 새 파일을 읽거나 처음부터 다시 하면 올린다 — 보이는 줄 목록을 이때만 다시 짠다 (아래 visibleNos)
  const [loadId, setLoadId] = useState(0);
  const [view, setView] = useState<BulkView>(initialBulkView);
  const [step, setStep] = useState<"idle" | "reading">("idle");
  const [pickError, setPickError] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [finder, setFinder] = useState<number | null>(null);
  const [categoryFor, setCategoryFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // 마지막 검사 뒤에 고친 줄. 칸을 벗어날 때 이 줄만 서버에 다시 묻는다
  const edited = useRef(new Set<number>());
  // 줄마다 마지막으로 보낸 검사 번호 — 먼저 보낸 요청의 응답이 늦게 와 새 결과를 덮어쓰지 않게, 번호가 다르면 그 응답은 버린다
  const sent = useRef(new Map<number, number>());
  const seq = useRef(0);
  const openTile = useTileOpen();
  const today = todayInSeoul();

  // 줄이 바뀌면 보관한다. 글자를 칠 때마다 줄 전체를 다시 쓰지 않게 잠깐 모아서 쓰고, 떠나거나 새로고침할 때는 마저 쓴다.
  // 남은 일이 없으면(전부 등록됨) 보관본을 비운다
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
  // 보이는 줄은 탭·검색·정렬을 바꾸거나 새 파일을 읽거나 확정했을 때만 다시 짠다. 칸을 고칠 때마다 다시 짜면 오류가 풀린 줄이 탭에서 빠져
  // 입력 칸이 사라진다(칸을 벗어남 검사도 안 돈다). 고친 줄은 다른 탭을 누르기 전까지 그 자리에 있다 — 개수만 바로 바뀐다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleNos = useMemo(() => visibleLines(state.lines, view).map((l) => l.rowNo), [view, loadId, state.created]);
  const byRow = new Map(state.lines.map((l) => [l.rowNo, l]));
  const shown = visibleNos.flatMap((n) => byRow.get(n) ?? []);
  const finderLine = finder === null ? undefined : byRow.get(finder);
  const hasOpen = state.lines.some((l) => !l.committed);
  const busy = committing || step === "reading";

  // 줄을 서버에 다시 물어본다. base 는 방금 낸 수정이 이미 들어간 상태 (이 렌더의 state 에는 아직 없으므로 호출한 쪽이 리듀서로 먼저 계산).
  // 응답 전엔 그 줄을 체크할 수 없다 (checking). 네트워크 실패면 이전 결과를 그대로 두고 체크만 풀린 채 둔다 — 칸을 다시 벗어나면 재시도
  const recheckRows = async (base: BulkState, rowNos: number[]) => {
    const wanted = new Set(rowNos);
    const lines = base.lines.filter((l) => wanted.has(l.rowNo) && !l.committed);
    if (lines.length === 0) return;
    const token = ++seq.current;
    lines.forEach((l) => {
      sent.current.set(l.rowNo, token);
      dispatch({ type: "checking", rowNo: l.rowNo });
    });
    const res = await listingBulkApi.check(lines.map(toApiRow));
    const fresh = new Set(lines.filter((l) => sent.current.get(l.rowNo) === token).map((l) => l.rowNo));
    const results = res.ok ? res.data.results : lines.map((l) => l.result);
    dispatch({ type: "rechecked", results: results.filter((r) => fresh.has(r.rowNo)) });
    if (!res.ok) setTopError(res.fields ? Object.values(res.fields).join(" ") : (listing.errors[res.code] ?? res.message));
  };

  const edit = (rowNo: number, field: keyof BulkFields, value: string, immediate: boolean) => {
    const action: BulkAction = { type: "edited", rowNo, field, value, today };
    dispatch(action);
    // 목록에서 고르는 칸은 고르는 순간 끝난 입력이라 바로 검사하고, 글자 입력 칸은 벗어날 때 검사한다
    if (immediate) {
      edited.current.delete(rowNo); // 방금 바로 검사하므로 칸을 벗어날 때 또 묻지 않는다
      void recheckRows(bulkReducer(state, action), [rowNo]);
    } else edited.current.add(rowNo);
  };

  const blurLine = (rowNo: number) => {
    if (edited.current.delete(rowNo)) void recheckRows(state, [rowNo]);
  };

  const pick = (rowNo: number, candidate: BulkPick) => {
    const action: BulkAction = { type: "picked", rowNo, candidate };
    dispatch(action);
    void recheckRows(bulkReducer(state, action), [rowNo]);
  };

  const unlock = (rowNo: number) => {
    const action: BulkAction = { type: "unlocked", rowNo };
    dispatch(action);
    void recheckRows(bulkReducer(state, action), [rowNo]);
  };

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setPickError(null);
    const error = !isXlsx(file) ? t.drop.notXlsx : checkUpload("excel", file);
    if (error) {
      setPickError(error);
      return;
    }
    if (hasOpen && !window.confirm(p.overwriteConfirm)) return;
    setStep("reading");
    const res = await listingBulkApi.parse(file);
    setStep("idle");
    if (!res.ok) {
      setPickError(res.fields?.file ?? (listing.errors[res.code] ?? res.message ?? t.readFailed));
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
    setView(initialBulkView);
    setLoadId((n) => n + 1);
    dispatch({ type: "loaded", rows: res.data.rows, results: res.data.results });
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
    const res = await listingBulkApi.template();
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

  // 선택 확정 = 체크한 줄, 전체 확정 = 오류 없는 줄 전부(필터로 숨은 줄 포함 — 확인 문구에 개수)
  const commit = async (lines: BulkLine[]) => {
    if (lines.length === 0 || busy) return;
    const rows = lines.map(toApiRow);
    // 필터·검색으로 지금 안 보이는데 확정에 들어가는 줄 — 선택 확정에도 있을 수 있다(체크한 뒤 탭을 옮긴 경우)
    const visible = new Set(visibleNos);
    const hidden = lines.filter((l) => !visible.has(l.rowNo)).length;
    if (!window.confirm(t.confirm(rows.length, lines.filter((l) => l.result.status === "NEW_MASTER").length, hidden))) return;
    setCommitting(true);
    setTopError(null);
    const res = await listingBulkApi.commit(rows);
    setCommitting(false);
    if (res.ok) {
      dispatch({ type: "committed", rowNos: rows.map((r) => r.rowNo) });
      return;
    }
    setTopError(listing.errors[res.code] ?? res.message);
    // 서버가 걸러 낸 줄의 사유를 표에 올린다 — 보낸 줄을 전부 다시 검사
    if (res.code === "LISTING_BULK_INVALID") void recheckRows(state, rows.map((r) => r.rowNo));
  };

  const commitSelected = () => void commit(state.lines.filter((l) => l.selected && !l.committed));
  const commitAll = () => void commit(state.lines.filter(canSelect));

  const reset = () => {
    if (hasOpen && !window.confirm(p.resetConfirm)) return;
    edited.current.clear();
    sent.current.clear();
    setTopError(null);
    setPickError(null);
    setRestored(false);
    setView(initialBulkView);
    setLoadId((n) => n + 1);
    dispatch({ type: "restored", state: initialBulkState });
    clearBulk();
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
            <span className="font-semibold text-primary">{p.dropCompact}</span> · {t.drop.hint}
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
            {p.reset}
          </button>
        )}
      </div>

      {restored && compact && (
        <p role="status" className="text-[13px] text-ink-2">
          {p.restored}
        </p>
      )}
      {state.created > 0 && (
        <p role="status" className="text-[13px] font-semibold text-ink">
          {t.done(state.created)} {stat.ok + stat.failed > 0 ? t.remaining(stat.ok + stat.failed) : t.allDone}
          {!hasOpen && (
            <button
              type="button"
              onClick={() => openTile("/my/activity?tab=sales", false)}
              className="ml-3 h-8 px-3 rounded-md border border-primary text-[13px] font-bold text-primary hover:bg-primary-soft"
            >
              {t.viewMine}
            </button>
          )}
        </p>
      )}
      {topError && (
        <p role="alert" className="text-[13px] text-down">
          {topError}
        </p>
      )}

      {/* 확정·읽는 중에는 칸 수정·체크를 막는다 — 보낸 뒤에 고친 값이 "등록됨"으로 표시돼 저장 안 된 값이 남는 일을 막는다 */}
      {compact && (
        <fieldset disabled={busy} className="contents">
          <div role="tablist" aria-label={p.title} className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={view.tab === tab}
                onClick={() => setView((v) => ({ ...v, tab }))}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium",
                  view.tab === tab ? "border-primary font-bold text-primary" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {p.tabs[tab]} <span className="num">{counts[tab]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={view.query}
              onChange={(e) => setView((v) => ({ ...v, query: e.target.value }))}
              aria-label={p.searchLabel}
              placeholder={p.searchPlaceholder}
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[13px] outline-none focus-visible:border-primary @md:max-w-xs @md:flex-none"
            />
            {/* 좁은 화면은 열 머리가 없어 정렬을 드롭다운으로 한다. 넓은 화면은 열 머리를 누른다 */}
            <span className="flex items-center gap-1 @5xl:hidden">
              <select
                aria-label={p.sortLabel}
                value={view.sort?.key ?? "rowNo"}
                onChange={(e) => setView((v) => ({ ...v, sort: { key: e.target.value as BulkSortKey, dir: v.sort?.dir ?? "asc" } }))}
                className="h-8 rounded-md border border-line bg-surface px-2 text-[13px]"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {p.sortOptions[key]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setView((v) => ({ ...v, sort: { key: v.sort?.key ?? "rowNo", dir: v.sort?.dir === "desc" ? "asc" : "desc" } }))}
                aria-label={view.sort?.dir === "desc" ? p.sortDesc : p.sortAsc}
                className={buttonClass}
              >
                {view.sort?.dir === "desc" ? "▼" : "▲"}
              </button>
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => dispatch({ type: "selectVisible", rowNos: visibleNos, value: true })} className={buttonClass}>
                {p.selectVisible}
              </button>
              <button type="button" onClick={() => dispatch({ type: "selectVisible", rowNos: visibleNos, value: false })} className={buttonClass}>
                {p.clearVisible}
              </button>
            </span>
          </div>
          <p className="tabular-nums text-[13px] text-ink-2">{t.summary(stat.ok, stat.failed, stat.selected)}</p>

          {shown.length === 0 ? (
            <p className="rounded-md border border-line bg-surface py-10 text-center text-[14px] text-ink-2">{p.emptyView}</p>
          ) : (
            <div>
              <BulkHeader view={view} onSort={(key) => setView((v) => ({ ...v, sort: nextSortFor(v, key) }))} />
              <BulkRows
                lines={shown}
                onToggle={(rowNo) => dispatch({ type: "toggled", rowNo })}
                onEdit={edit}
                onBlurLine={blurLine}
                onPick={pick}
                onFind={setFinder}
                onUnlock={unlock}
                onPickCategory={setCategoryFor}
              />
            </div>
          )}

          <BulkActionBar
            summary={t.actions.summary(stat.selected, committable)}
            primary={{ label: committing ? t.actions.committing : t.actions.commitSelected(stat.selected), disabled: busy || stat.selected === 0, onClick: commitSelected }}
            secondary={{ label: t.actions.commitAll(committable), disabled: busy || committable === 0, onClick: commitAll }}
          />
        </fieldset>
      )}

      {finder !== null && (
        <ProductSearchDialog
          // 줄에 올리거나 입력해 둔 상품명·제조사를 검색어에 미리 채운다(상품명이 비면 분류번호)
          initialQuery={finderLine?.fields.prodName || finderLine?.fields.prodClassNo || ""}
          initialBrand={finderLine?.fields.prodBrand ?? ""}
          onClose={() => setFinder(null)}
          onPick={(item: ProductSearchItem) => {
            const rowNo = finder;
            setFinder(null);
            pick(rowNo, {
              prodId: item.prodId,
              prodName: item.prodName,
              prodBrand: item.prodBrand,
              prodClassNo: item.prodClassNo,
              prodNo: item.prodNo,
              categoryCode: item.categoryCode,
            });
          }}
        />
      )}
      {categoryFor !== null && (
        <CategoryPickDialog
          value={state.lines.find((l) => l.rowNo === categoryFor)?.fields.categoryCode ?? ""}
          onClose={() => setCategoryFor(null)}
          onPick={(code) => {
            const rowNo = categoryFor;
            setCategoryFor(null);
            edit(rowNo, "categoryCode", code, true);
          }}
        />
      )}
    </div>
  );
}
