"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { canSelect, errorsOf, isLocked, type BulkLine, type BulkPick } from "@/lib/bulkListing";
import { tabOf, type BulkSortKey, type BulkView } from "@/lib/bulkListingView";
import { BULK_INPUT_FIELDS, type BulkFields, type BulkInputField } from "@/lib/validation/bulkListing";
import { PROD_STATES } from "@/lib/validation/listing";
import { cn } from "@/lib/utils";
import { listing } from "@/messages/listing";

const t = listing.bulk;
const p = listing.bulk.page;

const inputClass =
  "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus-visible:border-primary aria-invalid:border-down disabled:bg-bg disabled:text-ink-3";

/**
 * 넓은 화면(칸 너비 @5xl 이상)에서 한 줄의 윗단 열 배치. 머리 줄과 같은 값을 써서 열이 맞는다.
 * 선택 · 행 · 상태 · 상품명 · 제조사 · 상품상태 · 단가 · 수량 · 제공가능일
 */
const MAIN_GRID = "@5xl:grid-cols-[1.5rem_2.5rem_5.5rem_minmax(8rem,1.5fr)_minmax(6rem,1fr)_9.5rem_6rem_4.5rem_8.5rem]";

const MAIN_FIELDS: BulkInputField[] = ["prodName", "prodBrand", "prodState", "salesUnitPrice", "salesQuantity", "deliveryDate"];
const SUB_FIELDS: BulkInputField[] = ["prodClassNo", "prodNo", "categoryCode", "minOrderQuantity", "orderUnit", "description"];

interface HeaderProps {
  view: BulkView;
  onSort: (key: BulkSortKey) => void;
}

/** 넓은 화면의 열 머리. 눌러서 정렬하고(오름 → 내림 → 해제) 지금 정렬 방향을 화살표로 보인다 */
export function BulkHeader({ view, onSort }: HeaderProps) {
  const col = (key: BulkSortKey, label: string) => {
    const on = view.sort?.key === key;
    return (
      <button
        type="button"
        onClick={() => onSort(key)}
        aria-label={`${label} ${p.sortLabel}${on ? ` (${view.sort?.dir === "asc" ? p.sortAsc : p.sortDesc})` : ""}`}
        className={cn("flex items-center gap-0.5 text-left text-[12px] font-semibold hover:text-primary", on ? "text-primary" : "text-ink-2")}
      >
        {label}
        <span aria-hidden="true">{on ? (view.sort?.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    );
  };
  return (
    <div className={cn("hidden gap-2 border-b border-line bg-bg px-[calc(0.75rem+1px)] py-2 @5xl:grid", MAIN_GRID)}>
      <span aria-hidden="true" />
      {col("rowNo", p.columns.row)}
      {col("status", p.columns.status)}
      {col("prodName", t.fields.prodName)}
      {col("prodBrand", t.fields.prodBrand)}
      <span className="text-[12px] font-semibold text-ink-2">{t.fields.prodState}</span>
      {col("salesUnitPrice", t.fields.salesUnitPrice)}
      {col("salesQuantity", t.fields.salesQuantity)}
      <span className="text-[12px] font-semibold text-ink-2">{t.fields.deliveryDate}</span>
    </div>
  );
}

interface RowsProps {
  lines: BulkLine[];
  onToggle: (rowNo: number) => void;
  onEdit: (rowNo: number, field: keyof BulkFields, value: string, immediate: boolean) => void;
  onBlurLine: (rowNo: number) => void;
  onPick: (rowNo: number, pick: BulkPick) => void;
  onFind: (rowNo: number) => void;
  onUnlock: (rowNo: number) => void;
  onPickCategory: (rowNo: number) => void;
}

export function BulkRows({ lines, ...handlers }: RowsProps) {
  return (
    <ul className="flex flex-col gap-2 @5xl:gap-0 @5xl:divide-y @5xl:divide-line @5xl:rounded-b-md @5xl:border @5xl:border-t-0 @5xl:border-line">
      {lines.map((line) => (
        <BulkRow key={line.rowNo} line={line} {...handlers} />
      ))}
    </ul>
  );
}

function BulkRow({ line, onToggle, onEdit, onBlurLine, onPick, onFind, onUnlock, onPickCategory }: { line: BulkLine } & Omit<RowsProps, "lines">) {
  const errors = errorsOf(line);
  const failed = Object.keys(errors).length > 0;
  const tab = tabOf(line);
  const locked = isLocked(line);
  const status = line.result.status;
  const disabled = line.committed;

  const badge = line.committed ? p.committedBadge : failed ? t.line.failed : status === "NEW_MASTER" ? t.line.newMaster : t.line.matched;
  const badgeClass = line.committed
    ? "bg-bg text-ink-3"
    : failed
      ? "bg-down/10 text-down"
      : status === "NEW_MASTER"
        ? "bg-primary-soft text-primary"
        : "bg-green-soft text-green";

  const field = (name: BulkInputField, className?: string, hideLabelOnWide = false) => {
    const isProductCell = locked && ["prodName", "prodBrand", "prodClassNo", "prodNo", "categoryCode"].includes(name);
    const error = errors[name];
    return (
      <label key={name} className={cn("flex min-w-0 flex-col gap-1", className)}>
        <span className={cn("text-[12px] text-ink-2", hideLabelOnWide && "@5xl:sr-only")}>{t.fields[name]}</span>
        {name === "prodState" ? (
          <select
            value={line.fields.prodState}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={inputClass}
            onChange={(e) => onEdit(line.rowNo, "prodState", e.target.value, true)}
          >
            <option value="">{t.stateSelect}</option>
            {PROD_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : isProductCell ? (
          // 마스터를 고른 줄의 상품 칸은 잠겨 값만 보인다 — 고치려면 [직접 입력으로 바꾸기]
          <span className="flex h-8 items-center truncate rounded-md bg-bg px-2 text-[13px] text-ink-2" title={line.fields[name]}>
            {line.fields[name] || "-"}
          </span>
        ) : name === "categoryCode" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPickCategory(line.rowNo)}
            className={cn(inputClass, "text-left", !line.fields.categoryCode && "text-ink-3", error && "border-down")}
          >
            {line.fields.categoryCode || p.categoryEmpty}
          </button>
        ) : (
          <input
            value={line.fields[name]}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={inputClass}
            inputMode={["salesUnitPrice", "salesQuantity", "minOrderQuantity", "orderUnit"].includes(name) ? "numeric" : undefined}
            onChange={(e) => onEdit(line.rowNo, name, e.target.value, false)}
            // 칸을 벗어날 때 그 줄만 서버가 다시 검사한다 (상품 칸이면 마스터도 다시 찾는다)
            onBlur={() => onBlurLine(line.rowNo)}
          />
        )}
        {error && (
          <span role="alert" className="text-[12px] text-down">
            {error}
          </span>
        )}
      </label>
    );
  };

  return (
    <li className={cn("rounded-md border bg-surface @5xl:rounded-none @5xl:border-0", failed && !line.committed ? "border-down" : "border-line", line.committed && "opacity-70")}>
      <div className={cn("grid grid-cols-2 items-start gap-x-3 gap-y-2 p-3 @md:grid-cols-3 @3xl:grid-cols-4 @5xl:gap-x-2", MAIN_GRID)}>
        <div className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 @5xl:contents">
          <Checkbox
            checked={line.selected}
            disabled={!canSelect(line)}
            onCheckedChange={() => onToggle(line.rowNo)}
            aria-label={t.line.select(line.rowNo)}
            className="@5xl:mt-2"
          />
          <span className="tabular-nums text-[13px] font-semibold text-ink @5xl:mt-1.5">{t.line.row(line.rowNo)}</span>
          <span className={cn("w-fit rounded px-1.5 py-0.5 text-[12px] font-bold @5xl:mt-1", badgeClass)}>{badge}</span>
          {line.checking && (
            <span aria-busy="true" className="text-[12px] text-ink-3 @5xl:hidden">
              {t.line.checking}
            </span>
          )}
        </div>
        {MAIN_FIELDS.map((name) => field(name, name === "prodName" ? "col-span-2 @5xl:col-span-1" : undefined, true))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line-2 px-3 py-2 @md:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6 @5xl:pl-[calc(0.75rem+1.5rem+0.5rem)]">
        {SUB_FIELDS.map((name) => field(name, name === "description" ? "col-span-2" : undefined))}
      </div>
      {/* 서버가 칸에 못 붙인 사유(prodId 등) */}
      {Object.entries(errors)
        .filter(([key]) => !(BULK_INPUT_FIELDS as readonly string[]).includes(key))
        .map(([key, message]) => (
          <p key={key} role="alert" className="px-3 pb-2 text-[12px] text-down">
            {t.fields[key] ?? key}: {message}
          </p>
        ))}
      {!line.committed && (
        <ProductActions
          line={line}
          tab={tab}
          locked={locked}
          onPick={(pick) => onPick(line.rowNo, pick)}
          onFind={() => onFind(line.rowNo)}
          onUnlock={() => onUnlock(line.rowNo)}
        />
      )}
    </li>
  );
}

/** 줄 아래: 후보 버튼 · [상품 찾기] · [직접 입력으로 바꾸기]와 안내 */
function ProductActions({
  line,
  tab,
  locked,
  onPick,
  onFind,
  onUnlock,
}: {
  line: BulkLine;
  tab: ReturnType<typeof tabOf>;
  locked: boolean;
  onPick: (pick: BulkPick) => void;
  onFind: () => void;
  onUnlock: () => void;
}) {
  const buttonClass = "h-7 rounded-md border border-line px-2 text-[12px] text-ink hover:bg-bg";
  return (
    <div className="flex flex-col gap-1.5 border-t border-line-2 px-3 py-2">
      {tab === "new" && <p className="text-[12px] text-ink-2">{t.line.newMasterHint}</p>}
      {line.result.notices.map((n) => (
        <p key={n} className="text-[12px] text-ink-3">
          {n}
        </p>
      ))}
      {!locked && line.result.candidates.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-semibold text-ink">{t.line.candidates}</p>
          <ul className="flex flex-wrap gap-2">
            {line.result.candidates.map((c) => (
              <li key={c.prodId}>
                <button type="button" onClick={() => onPick(c)} className={buttonClass}>
                  {t.line.pickCandidate(c.prodName, c.prodBrand)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {locked ? (
          <>
            <span className="text-[12px] text-ink-2">{p.masterLocked(line.fields.prodName || line.result.matchedName || line.fields.prodId)}</span>
            <button type="button" onClick={onFind} className={buttonClass}>
              {p.findOther}
            </button>
            <button type="button" onClick={onUnlock} className={buttonClass}>
              {p.enterManual}
            </button>
          </>
        ) : (
          <button type="button" onClick={onFind} className={buttonClass}>
            {p.findProduct}
          </button>
        )}
        {line.checking && (
          <span aria-busy="true" className="hidden text-[12px] text-ink-3 @5xl:inline">
            {t.line.checking}
          </span>
        )}
      </div>
    </div>
  );
}
