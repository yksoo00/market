"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import { Icon } from "@/components/common/Icon";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/format";
import { isOwner } from "@/lib/listingDetail";
import { activeFilterCount, buildSearchHref, clearFilters, listingHref, type SearchQuery, type SearchScope } from "@/lib/search";
import { my } from "@/messages/my";
import { search as t } from "@/messages/search";
import type { ListingSearchItem } from "@/types/listing";

const r = t.result;
const keyOf = (i: ListingSearchItem) => `${i.userId}/${i.regDate}`;
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
  /** 거래 가능 행에서 보조 글자색 */
  muted?: boolean;
  /** 말줄임되는 칸의 전체 값 (마우스 올리면) */
  title?: (item: ListingSearchItem) => string | undefined;
  cell: (item: ListingSearchItem, done: boolean) => ReactNode;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;
const c = t.columns;

// 체크·상품명(왼쪽 고정) 뒤의 열. 순서·항목은 사용자가 정한 그대로(상품명·상품번호·제조사·제조일·상품상태·
// 상품설명·데이터시트·사진·보증기한·불량지원·대체품·테스트리포트·정품인증서). 상품설명은 유무(O/X)만, 내용은 마우스를 올리면
const columns: Column[] = [
  { label: c.prodNo, width: "w-36", mono: true, title: (i) => i.prodNo ?? undefined, cell: (i) => i.prodNo ?? DASH },
  { label: c.brand, width: "w-32", title: (i) => i.prodBrand, cell: (i) => i.prodBrand },
  { label: c.mufcDate, width: "w-26", mono: true, muted: true, cell: (i) => i.mufcDate ?? DASH },
  { label: c.state, width: "w-26", cell: (i, done) => (done ? <CompletedBadge /> : i.prodState) },
  { label: c.prodDescription, width: "w-18", align: "center", title: (i) => i.prodDescription ?? undefined, cell: (i) => <Mark on={i.prodDescription !== null} label={c.prodDescription} /> },
  { label: c.dataSheet, width: "w-20", align: "center", cell: (i) => <Has on={i.hasDataSheet} icon="file" label={c.dataSheet} /> },
  { label: c.photo, width: "w-12", align: "center", cell: (i) => <Has on={i.hasPhoto} icon="image" label={c.photo} /> },
  { label: c.warranty, width: "w-26", mono: true, muted: true, cell: (i) => i.warrantyUntil ?? DASH },
  { label: c.coverage, width: "w-18", align: "center", cell: (i) => i.warrantyCoverage ?? DASH },
  { label: c.replaceProd, width: "w-16", align: "center", cell: (i) => <Mark on={i.hasReplaceProd} label={c.replaceProd} /> },
  { label: c.testReport, width: "w-24", align: "center", cell: (i) => <Mark on={i.hasTestReport} label={c.testReport} /> },
  { label: c.certificate, width: "w-22", align: "center", cell: (i) => <Mark on={i.hasCertificate} label={c.certificate} /> },
];

interface Props {
  items: ListingSearchItem[];
  query: SearchQuery;
  /** 같은 조건의 전체 개수. items 는 [더 보기]로 받은 만큼만 */
  total: number;
  /** mine = 내 판매글 모드: 선택·견적·구매 없이 행마다 [수정] */
  scope?: SearchScope;
  /** mine 모드에서 표의 [수정] 을 눌렀을 때 (행 안 수정). 없으면 [수정] 은 수정 화면 링크 */
  onEdit?: (item: ListingSearchItem) => void;
  /** mine 모드: 로그인한 사용자 id. 내 글에만 [수정]을 그린다 (서버가 mine=true 로 거르지 못해도 남의 글에 수정 버튼이 뜨지 않게) */
  ownerId?: string | null;
}

// 선택 상태는 결과 집합마다 새로 시작한다 — 페이지에서 key={buildSearchHref(query)}로 다시 마운트
export function ResultList({ items, query, total, scope = "search", onEdit, ownerId = null }: Props) {
  const router = useRouter();
  const mine = scope === "mine";
  const canEdit = (item: ListingSearchItem) => mine && isOwner(ownerId, item.userId);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // seq: 같은 문구가 연달아 나와도 알림 요소를 새로 그려 스크린리더가 다시 읽게 한다 (key 로 사용)
  const [notice, setNotice] = useState<number | null>(null);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allChecked = items.length > 0 && selected.size === items.length;
  const headerChecked = allChecked ? true : selected.size > 0 ? "indeterminate" : false;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(items.map(keyOf)));
  // TODO(거래 흐름 미정, decisions.md 미정 항목): 견적 요청 → 견적 확인 흐름이 정해지면 실제 동작으로 교체
  const showPending = () => setNotice((prev) => (prev ?? 0) + 1);
  const go = (item: ListingSearchItem) => router.push(listingHref(item));

  if (items.length === 0) return <Empty query={query} scope={scope} />;

  const actions = (size: string) => (
    <>
      <button
        type="button"
        disabled={selected.size === 0}
        onClick={showPending}
        className={`${size} px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none`}
      >
        {r.quote}
      </button>
      <button
        type="button"
        disabled={selected.size === 0}
        onClick={showPending}
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
          {selected.size > 0 && r.selected(selected.size)}
        </p>
        {!mine && <div className="hidden @min-[36rem]:flex gap-2">{actions("h-8.5")}</div>}
      </div>

      {!mine && notice !== null && (
        <div key={notice} role="status" className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className="min-w-0">{r.pending}</span>
          <button type="button" aria-label={r.dismiss} onClick={() => setNotice(null)} className="shrink-0 text-ink-3 hover:text-ink">
            <Icon name="close" size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* 데스크톱: 표. 열이 많아(16) 칸에 다 안 들어가므로 가로 스크롤하고, 체크·상품명은 왼쪽에 고정해
          어느 열을 보든 어떤 매물인지 보이게 한다.
          표↔카드 기준은 @md(768)가 아니라 칸 폭 576 — 타일 반반 분할이면 칸이 768 미만(1440 창이면 720)이라
          카드로 줄어들었다. 분할에서도 표가 옆으로 펼쳐져야 한다 (사용자 지시). 폰(390)은 그대로 카드 */}
      <div className="hidden @min-[36rem]:block rounded-md border border-line bg-surface overflow-x-auto">
        <table className="w-full min-w-334 table-fixed text-[13px]">
          <colgroup>
            {!mine && <col className="w-10" />}
            <col className="w-48" />
            {columns.map((c) => (
              <col key={c.label} className={c.width} />
            ))}
            {mine && <col className="w-20" />}
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
                <th scope="col" className="sticky right-0 z-10 bg-bg px-2 font-medium text-center border-l border-line-2">
                  {my.mine.editColumn}
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
                      <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} aria-label={r.selectRow(item.prodName)} />
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
                      className={`px-2 truncate ${alignClass[c.align ?? "left"]} ${c.mono ? "num" : ""} ${c.strong ? "font-semibold" : ""} ${c.muted && !done ? "text-ink-2" : ""} ${i === columns.length - 1 ? "pr-3" : ""}`}
                    >
                      {c.cell(item, done)}
                    </td>
                  ))}
                  {mine && (
                    <td className="sticky right-0 z-10 bg-surface group-hover:bg-bg px-2 text-center border-l border-line-2" onClick={stop}>
                      {canEdit(item) && <EditButton item={item} onEdit={onEdit} />}
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
                  <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} aria-label={r.selectRow(item.prodName)} />
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
                {/* 좁은 카드는 칸 단위 편집이 어려워 행 안 수정 대신 수정 화면으로 간다 */}
                {canEdit(item) && (
                  <div onClick={stop}>
                    <Link
                      href={`${listingHref(item)}/edit`}
                      aria-label={my.mine.editAria(item.prodName)}
                      className="inline-flex h-8 px-3 items-center rounded-md border border-primary text-primary text-[13px] font-medium hover:bg-primary-soft"
                    >
                      {my.mine.edit}
                    </Link>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* 모바일: 선택하면 아래(탭바 위)에 고정. main 이 스크롤 칸이라 sticky 로 칸 바닥에 붙는다 */}
      {!mine && selected.size > 0 && (
        <div className="@min-[36rem]:hidden sticky bottom-0 -mx-4 px-4 py-2.5 flex gap-2 bg-surface border-t border-line [&>button]:flex-1">
          {actions("h-10")}
        </div>
      )}
    </section>
  );
}

/** 표의 [수정]. 행 안 수정(onEdit)이 연결되면 그걸 부르고, 아니면 수정 화면으로 가는 링크 */
function EditButton({ item, onEdit }: { item: ListingSearchItem; onEdit?: (item: ListingSearchItem) => void }) {
  const cls = "inline-flex h-7 px-2.5 items-center rounded-md border border-primary text-primary text-[13px] font-medium hover:bg-primary-soft";
  if (onEdit) {
    return (
      <button type="button" onClick={() => onEdit(item)} aria-label={my.mine.editAria(item.prodName)} className={cls}>
        {my.mine.edit}
      </button>
    );
  }
  return (
    <Link href={`${listingHref(item)}/edit`} aria-label={my.mine.editAria(item.prodName)} className={cls}>
      {my.mine.edit}
    </Link>
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
function Mark({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <span role="img" aria-label={label} className="text-primary font-semibold">
      ○
    </span>
  ) : (
    <span className="text-ink-3">
      <span aria-hidden="true">✕</span>
      <span className="sr-only">{`${label} ${r.none}`}</span>
    </span>
  );
}

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
