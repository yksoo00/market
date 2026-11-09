"use client";

import { BuyConditionFields } from "@/components/buy/BuyConditionFields";
import { TraitsLine } from "@/components/buy/TraitsLine";
import { Checkbox } from "@/components/ui/checkbox";
import { canSelect, errorsOf, isLocked, type BuyLine, type BuyPick } from "@/lib/buyBulk";
import { tabOf } from "@/lib/buyBulkView";
import { formatPrice } from "@/lib/format";
import { BUY_CONDITION_FIELDS, BUY_INPUT_FIELDS, type BuyFields, type BuyInputField } from "@/lib/validation/buyBulk";
import { cn } from "@/lib/utils";
import { buyBulk } from "@/messages/buyBulk";

const t = buyBulk;

const inputClass =
  "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus-visible:border-primary aria-invalid:border-down disabled:bg-bg disabled:text-ink-3";

const wideFields: BuyInputField[] = ["prodName", "remarks"];

interface RowsProps {
  lines: BuyLine[];
  onToggle: (rowNo: number) => void;
  onEdit: (rowNo: number, field: keyof BuyFields, value: string) => void;
  /** 고르는 칸(조건의 상태·보증·증빙)은 바꾼 즉시 그 줄을 다시 검사한다 */
  onEditNow: (rowNo: number, field: keyof BuyFields, value: string) => void;
  onBlurLine: (rowNo: number) => void;
  onPick: (rowNo: number, pick: BuyPick) => void;
  onFind: (rowNo: number) => void;
  onUnlock: (rowNo: number) => void;
  onOpenOptions: (rowNo: number) => void;
  onChoose: (rowNo: number, sellerId: string, regDate: string) => void;
}

/** 줄 카드 목록. 칸 너비가 좁아도 같은 모양(칸 격자 2~4열)이고, 정렬은 위쪽 [정렬] 드롭다운으로 한다 */
export function BuyBulkRows({ lines, ...handlers }: RowsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line) => (
        <BuyBulkRow key={line.rowNo} line={line} {...handlers} />
      ))}
    </ul>
  );
}

function BuyBulkRow({ line, onToggle, onEdit, onEditNow, onBlurLine, onPick, onFind, onUnlock, onOpenOptions, onChoose }: { line: BuyLine } & Omit<RowsProps, "lines">) {
  const errors = errorsOf(line);
  const failed = Object.keys(errors).length > 0;
  const tab = tabOf(line);
  const locked = isLocked(line);
  const result = line.result;
  const disabled = line.added;

  const badge = line.added ? t.line.added : failed ? t.line.failed : result.status === "UNAVAILABLE" ? t.line.unavailable : t.line.available;
  const badgeClass = line.added
    ? "bg-bg text-ink-3"
    : failed
      ? "bg-down/10 text-down"
      : result.status === "UNAVAILABLE"
        ? "bg-bg text-ink-2"
        : "bg-green-soft text-green";

  const field = (name: BuyInputField) => {
    const isProductCell = locked && ["prodName", "prodBrand", "prodClassNo"].includes(name);
    const error = errors[name];
    return (
      <label key={name} className={cn("flex min-w-0 flex-col gap-1", wideFields.includes(name) && "col-span-2")}>
        <span className="text-[12px] text-ink-2">{t.fields[name]}</span>
        {isProductCell ? (
          // 마스터를 고른 줄의 상품 칸은 잠겨 값만 보인다 — 고치려면 [직접 입력으로 바꾸기]
          <span className="flex h-8 items-center truncate rounded-md bg-bg px-2 text-[13px] text-ink-2" title={line.fields[name as keyof BuyFields]}>
            {line.fields[name as keyof BuyFields] || "-"}
          </span>
        ) : (
          <input
            value={line.fields[name]}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={inputClass}
            inputMode={name === "orderQuantity" ? "numeric" : undefined}
            onChange={(e) => onEdit(line.rowNo, name, e.target.value)}
            // 칸을 벗어날 때 그 줄만 서버가 다시 검사한다 (상품 칸이면 마스터도, 수량이면 살 수 있는 매물도 다시 정한다)
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

  const chosen = result.chosen;
  const hasOptions = result.options.length > 0 || result.alternatives.length > 0;

  return (
    <li className={cn("rounded-md border bg-surface", failed && !line.added ? "border-down" : "border-line", line.added && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 bg-bg px-3 py-2">
        <Checkbox checked={line.selected} disabled={!canSelect(line)} onCheckedChange={() => onToggle(line.rowNo)} aria-label={t.line.select(line.rowNo)} />
        <span className="num text-[13px] font-semibold text-ink">{t.line.row(line.rowNo)}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[12px] font-bold", badgeClass)}>{badge}</span>
        {result.substituted && chosen && (
          <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[12px] font-bold text-primary">
            {t.line.substituted(result.matchedName ?? line.fields.prodName, result.alternatives.find((a) => a.options.some((o) => o.sellerId === chosen.sellerId && o.regDate === chosen.regDate))?.prodName ?? "")}
          </span>
        )}
        {!failed && locked && result.matchedName && <span className="text-[13px] text-ink-2">{t.line.matchedAs(result.matchedName)}</span>}
        {line.checking && (
          <span aria-busy="true" className="text-[12px] text-ink-3">
            {t.line.checking}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 @md:grid-cols-3 @3xl:grid-cols-4">{BUY_INPUT_FIELDS.map((name) => field(name))}</div>
      {!line.added && <BuyConditionFields line={line} onEdit={onEdit} onBlurLine={onBlurLine} onEditNow={onEditNow} />}

      {/* 고른 매물 */}
      <div className="flex flex-col gap-1.5 border-t border-line-2 px-3 py-2">
        {chosen ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
            <span className="text-[12px] text-ink-2">{t.line.chosen}</span>
            <span className="font-semibold text-ink">{t.line.seller(chosen.sellerNickname)}</span>
            <span className="num">{t.line.price(formatPrice(chosen.unitPrice))}</span>
            <span className="num">{t.line.stock(chosen.stock)}</span>
            {chosen.deliveryDate && <span className="num">{t.line.delivery(chosen.deliveryDate)}</span>}
            <TraitsLine traits={chosen.traits} className="text-[12px] text-ink-2" />
            {chosen.replaceHint && <span className="text-[12px] text-ink-3">{t.option.replaceHint(chosen.replaceHint)}</span>}
          </div>
        ) : (
          !failed &&
          !line.added &&
          result.status === "UNAVAILABLE" && <p className="text-[13px] text-ink-2">{t.line.noListing}</p>
        )}
        {errors.listing && (
          <p role="alert" className="text-[12px] text-down">
            {t.fields.listing}: {errors.listing}
          </p>
        )}
        {!line.added && result.status === "UNAVAILABLE" && result.alternatives.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-semibold text-ink">{t.line.alternatives}</p>
            <ul className="flex flex-col gap-1">
              {result.alternatives.map((alt) => {
                const best = [...alt.options].filter((o) => o.reason === null).sort((a, b) => a.unitPrice - b.unitPrice)[0];
                return (
                  <li key={alt.prodId} className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-ink-2">{best ? t.line.alternativeOffer(alt.prodName, best.sellerNickname, formatPrice(best.unitPrice)) : alt.prodName}</span>
                    {best && (
                      <button type="button" onClick={() => onChoose(line.rowNo, best.sellerId, best.regDate)} className="h-7 rounded-md border border-line px-2 text-[12px] text-ink hover:bg-bg">
                        {t.line.useAlternative}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {!line.added && hasOptions && (
          <div>
            <button type="button" onClick={() => onOpenOptions(line.rowNo)} className="h-7 rounded-md border border-line px-2 text-[12px] text-ink hover:bg-bg">
              {t.line.changeListing}
            </button>
          </div>
        )}
        {line.addError && (
          <p role="alert" className="text-[12px] text-down">
            {line.addError}
          </p>
        )}
      </div>

      {/* 서버가 칸에 못 붙인 사유(prodId 등) */}
      {Object.entries(errors)
        // 조건 칸의 오류는 조건 구역에서 그 칸 아래에 보인다
        .filter(([key]) => !(BUY_INPUT_FIELDS as readonly string[]).includes(key) && !(BUY_CONDITION_FIELDS as readonly string[]).includes(key) && key !== "listing")
        .map(([key, message]) => (
          <p key={key} role="alert" className="px-3 pb-2 text-[12px] text-down">
            {t.fields[key] ?? key}: {message}
          </p>
        ))}

      {!line.added && (
        <ProductActions line={line} tab={tab} locked={locked} onPick={(pick) => onPick(line.rowNo, pick)} onFind={() => onFind(line.rowNo)} onUnlock={() => onUnlock(line.rowNo)} />
      )}
    </li>
  );
}

/** 줄 아래: 후보 칩 · [상품 찾기] · [직접 입력으로 바꾸기] */
function ProductActions({
  line,
  tab,
  locked,
  onPick,
  onFind,
  onUnlock,
}: {
  line: BuyLine;
  tab: ReturnType<typeof tabOf>;
  locked: boolean;
  onPick: (pick: BuyPick) => void;
  onFind: () => void;
  onUnlock: () => void;
}) {
  const buttonClass = "h-7 rounded-md border border-line px-2 text-[12px] text-ink hover:bg-bg";
  // 마스터를 못 찾은 줄(확인 필요 + 후보)이거나 이미 마스터를 고른 줄에서만 상품 바꾸기 버튼을 보인다 — 매물 있음 줄에까지 늘 보이면 시끄럽다
  const productProblem = tab === "failed" && !line.result.prodId;
  if (!locked && !productProblem && line.result.candidates.length === 0) {
    return (
      <div className="border-t border-line-2 px-3 py-2">
        <button type="button" onClick={onFind} className={buttonClass}>
          {t.line.findProduct}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 border-t border-line-2 px-3 py-2">
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
        <button type="button" onClick={onFind} className={buttonClass}>
          {locked ? t.line.findOther : t.line.findProduct}
        </button>
        {locked && (
          <button type="button" onClick={onUnlock} className={buttonClass}>
            {t.line.enterManual}
          </button>
        )}
      </div>
    </div>
  );
}
