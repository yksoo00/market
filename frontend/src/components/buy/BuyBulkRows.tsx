"use client";

import { useState } from "react";
import { BuyConditionFields } from "@/components/buy/BuyConditionFields";
import { TraitsLine } from "@/components/buy/TraitsLine";
import type { ListingOption } from "@/types/cartBulk";
import { Checkbox } from "@/components/ui/checkbox";
import { blockedOptions, canSelect, cleanOptions, errorsOf, isClean, isLocked, softOptions, type BuyLine, type BuyPick } from "@/lib/buyBulk";
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
  onChoose: (rowNo: number, sellerId: string, regDate: string) => void;
  /** 매물 카드 본문을 누르면 그 매물의 상세 페이지를 보조 칸으로 연다 */
  onOpenDetail: (sellerId: string, regDate: string) => void;
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

function BuyBulkRow({ line, onToggle, onEdit, onEditNow, onBlurLine, onPick, onFind, onUnlock, onChoose, onOpenDetail }: { line: BuyLine } & Omit<RowsProps, "lines">) {
  const errors = errorsOf(line);
  const failed = Object.keys(errors).length > 0;
  const tab = tabOf(line);
  const locked = isLocked(line);
  const result = line.result;
  const disabled = line.added;

  const badge = line.added ? t.line.added : failed ? t.line.failed : result.status === "UNAVAILABLE" ? t.line.unavailable : result.status === "CHOOSE" ? t.line.choose : t.line.available;
  const badgeClass = line.added
    ? "bg-bg text-ink-3"
    : failed
      ? "bg-down/10 text-down"
      : result.status === "UNAVAILABLE"
        ? "bg-bg text-ink-2"
        : result.status === "CHOOSE"
          ? "bg-primary-soft text-primary"
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
  // 대체품 제안은 조건에 맞는 매물이 하나도 없을 때만 (서버도 그때만 계산한다)
  const showAlternatives = !line.added && result.alternatives.length > 0 && cleanOptions(result).length === 0;
  const hasExtra = Boolean((result.substituted && chosen) || errors.listing || (showAlternatives) || line.addError);

  // 줄 머리가 제목이자 드롭다운이다 — 눌러 줄 전체(입력 칸·조건·매물 카드)를 접고 편다. 처음엔 손볼 일이 있는 줄(선택 필요·오류·담기 실패)만 펼치고,
  // 이미 고른 줄·매물 없음 줄·담은 줄은 접어 100줄이어도 한 줄씩 훑어볼 수 있게 한다
  const parts = partsOf(result);
  const name = result.matchedName ?? line.fields.prodName;
  // 상품을 하나 이상 찾았으면(여러 상품의 매물이 합쳐진 줄 포함) 매물 카드를 보인다
  const hasMaster = result.masterCount > 0;
  const state = result.substituted
    ? t.group.substituted
    : chosen
      ? t.group.chosen(t.line.seller(chosen.sellerNickname), formatPrice(chosen.unitPrice)) + (result.masterCount > 1 ? ` · ${chosen.prodName}` : "")
      : parts.noneSelectable
        ? t.group.unavailable
        : t.group.none;
  // 안내(이름이 정확히 같지 않아 비슷한 상품을 보여 줌)가 있는 줄도 펼친다 — 접으면 안내가 가려져 다른 상품을 모르고 고를 수 있다
  const needsAttention = failed || result.status === "CHOOSE" || showAlternatives || result.notices.length > 0 || Boolean(line.addError);
  const [open, setOpen] = useState(needsAttention && !line.added);
  // 조건·수량을 고쳐 다시 검사한 결과 손볼 일이 생기면 펼친다 (렌더 중 상태 보정 — effect 로 하면 한 번 더 그려진다)
  const [seenAttention, setSeenAttention] = useState(needsAttention);
  if (seenAttention !== needsAttention) {
    setSeenAttention(needsAttention);
    if (needsAttention && !line.added) setOpen(true);
  }
  // 담은 줄은 접는다 (펼쳐 둔 줄도)
  const [seenAdded, setSeenAdded] = useState(line.added);
  if (seenAdded !== line.added) {
    setSeenAdded(line.added);
    if (line.added) setOpen(false);
  }
  const regionId = `buy-line-${line.rowNo}`;

  return (
    <li className={cn("rounded-md border bg-surface", failed && !line.added ? "border-down" : "border-line", line.added && "opacity-70")}>
      <div className={cn("flex items-center gap-x-3 bg-bg px-3 py-2", open && "border-b border-line-2")}>
        <Checkbox checked={line.selected} disabled={!canSelect(line)} onCheckedChange={() => onToggle(line.rowNo)} aria-label={t.line.select(line.rowNo)} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? regionId : undefined}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 flex-col gap-1 text-left"
        >
          {/* 윗줄은 한 줄 고정(이름만 줄어든다), 아랫줄 요약은 좁으면 줄바꿈 — 접은 줄이 모바일에서도 두 줄을 넘지 않게 */}
          <span className="flex min-w-0 items-center gap-x-2">
            <span className="tabular-nums shrink-0 text-[13px] font-semibold text-ink">{t.line.row(line.rowNo)}</span>
            <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[12px] font-bold", badgeClass)}>{badge}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{name.trim() === "" ? t.line.untitled : name}</span>
            <span aria-hidden="true" className="shrink-0 text-ink-2">
              {open ? "▾" : "▸"}
            </span>
          </span>
          {(hasMaster || line.checking) && (
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {hasMaster && !line.added && <span className="text-[12px] text-ink-2">{t.group.count(result.options.length)}</span>}
              {hasMaster && <span className={cn("rounded px-1.5 py-0.5 text-[12px]", chosen ? "bg-green-soft text-green" : "bg-surface text-ink-2")}>{state}</span>}
              {result.substituted && chosen && (
                <span className="min-w-0 truncate rounded bg-primary-soft px-1.5 py-0.5 text-[12px] font-bold text-primary">
                  {t.line.substituted(result.matchedName ?? line.fields.prodName, result.alternatives.find((a) => a.options.some((o) => o.sellerId === chosen.sellerId && o.regDate === chosen.regDate))?.prodName ?? "")}
                </span>
              )}
              {line.checking && (
                <span aria-busy="true" className="text-[12px] text-ink-3">
                  {t.line.checking}
                </span>
              )}
            </span>
          )}
        </button>
      </div>
      {open && (
        <div id={regionId}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 @md:grid-cols-3 @3xl:grid-cols-4">{BUY_INPUT_FIELDS.map((name) => field(name))}</div>
          {!line.added && <BuyConditionFields line={line} onEdit={onEdit} onBlurLine={onBlurLine} onEditNow={onEditNow} />}

          {/* 이 줄 상품의 매물 카드 — 어느 매물을 살지는 구매자가 고른다 */}
          {!line.added && hasMaster && <ListingCards line={line} parts={parts} onChoose={onChoose} onOpenDetail={onOpenDetail} />}

          {hasExtra && (
            <div className="flex flex-col gap-1.5 border-t border-line-2 px-3 py-2">
              {/* 대체 매물을 골랐으면 그 매물은 위 그룹(원래 상품의 매물)에 없어서 여기에 보인다 */}
              {result.substituted && chosen && (
                <div className="flex flex-col gap-0.5 rounded-md border border-primary bg-primary-soft px-2 py-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                    <span className="font-semibold text-ink">{t.line.seller(chosen.sellerNickname)}</span>
                    <span className="tabular-nums">{t.line.price(formatPrice(chosen.unitPrice))}</span>
                    <span className="tabular-nums">{t.line.stock(chosen.stock)}</span>
                    {chosen.deliveryDate && <span className="tabular-nums">{t.line.delivery(chosen.deliveryDate)}</span>}
                  </div>
                  <TraitsLine traits={chosen.traits} className="text-[12px] text-ink-2" />
                  {chosen.mismatches.map((text) => (
                    <p key={text} className="text-[12px] text-ink-2">
                      {t.option.mismatch(text)}
                    </p>
                  ))}
                </div>
              )}
              {errors.listing && (
                <p role="alert" className="text-[12px] text-down">
                  {t.fields.listing}: {errors.listing}
                </p>
              )}
              {showAlternatives && (
                <div className="flex flex-col gap-1">
                  <p className="text-[12px] font-semibold text-ink">{t.line.alternatives}</p>
                  <ul className="flex flex-col gap-1">
                    {result.alternatives.map((alt) => {
                      // 조건에 맞는 매물을 먼저, 없으면 조건과 다른 매물 중 가장 싼 것을 제안한다 (고르면 다른 점이 줄에 남는다)
                      const best = [...alt.options].filter((o) => o.reason === null).sort((a, b) => Number(!isClean(a)) - Number(!isClean(b)) || a.unitPrice - b.unitPrice)[0];
                      return (
                        <li key={alt.prodId} className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] text-ink-2">
                            {best ? t.line.alternativeOffer(alt.prodName, best.sellerNickname, formatPrice(best.unitPrice)) : alt.prodName}
                            {best && !isClean(best) && ` (${t.line.mismatchNote}: ${best.mismatches.join(" · ")})`}
                          </span>
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
              {line.addError && (
                <p role="alert" className="text-[12px] text-down">
                  {line.addError}
                </p>
              )}
            </div>
          )}

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
        </div>
      )}
    </li>
  );
}

/** 매물을 세 구역으로 나눈다. 서버가 고정 순서로 보낸 options 의 순서를 그대로 지킨다 */
function partsOf(result: BuyLine["result"]) {
  const fit = cleanOptions(result);
  const soft = softOptions(result);
  const blocked = blockedOptions(result);
  return { fit, soft, blocked, noneSelectable: fit.length + soft.length === 0 };
}

/**
 * 줄 안의 매물 카드들 — 매물 하나가 카드 하나다(위쪽 줄 카드와 같은 모양: 머리 띠 + 라벨·값 칸 격자). 순서는 서버가 정한 고정 순서 그대로:
 * 조건에 맞는 매물(맞는 게 여럿이면 첫 카드에 "추천") → 조건과 다른 매물(머리에 꼬리표) → 고를 수 없는 매물(회색, 고를 수 있는 매물이 있으면 접어 둠).
 * 미리 고르는 건 맞는 매물이 딱 하나일 때뿐(서버)
 */
function ListingCards({
  line,
  parts,
  onChoose,
  onOpenDetail,
}: {
  line: BuyLine;
  parts: ReturnType<typeof partsOf>;
  onChoose: (rowNo: number, sellerId: string, regDate: string) => void;
  onOpenDetail: (sellerId: string, regDate: string) => void;
}) {
  const { fit, soft, blocked, noneSelectable } = parts;
  const [showBlocked, setShowBlocked] = useState(false);
  const blockedShown = showBlocked || noneSelectable;
  const card = (o: ListingOption, recommended = false) => (
    <ListingCard key={`${o.sellerId}/${o.regDate}`} option={o} line={line} recommended={recommended} showProduct={line.result.masterCount > 1} onChoose={onChoose} onOpenDetail={onOpenDetail} />
  );

  return (
    <div className="flex flex-col gap-2 border-t border-line-2 px-3 py-2">
      {line.result.notices.map((text) => (
        <p key={text} className="text-[12px] text-ink-2">
          {text}
        </p>
      ))}
      {line.result.options.length === 0 && <p className="rounded-md border border-line py-3 text-center text-[13px] text-ink-2">{t.group.empty}</p>}
      {fit.map((o, i) => card(o, fit.length > 1 && i === 0))}
      {soft.map((o) => card(o))}
      {blocked.length > 0 && !noneSelectable && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-2">{t.group.blocked(blocked.length)}</span>
          <button type="button" onClick={() => setShowBlocked((v) => !v)} className="text-[12px] text-primary underline underline-offset-2">
            {showBlocked ? t.group.hideBlocked : t.group.showBlocked}
          </button>
        </div>
      )}
      {blockedShown && blocked.map((o) => card(o))}
    </div>
  );
}

/** 라벨 위 + 값 칸 아래 — 위쪽 줄 카드의 잠긴 칸과 같은 모양(읽기만) */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[12px] text-ink-2">{label}</span>
      <span className="flex min-h-8 items-center truncate rounded-md bg-bg px-2 text-[13px] text-ink-2">{children}</span>
    </span>
  );
}

/** 서류 칩 — 있으면 ✓, 없으면 ✗ */
function EvidenceChip({ name, has }: { name: string; has: boolean }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[12px]", has ? "bg-green-soft text-green" : "bg-bg text-ink-3")}>
      {has ? "✓" : "✗"} {name}
    </span>
  );
}

/**
 * 매물 한 건. 머리 띠의 동그라미(와 판매자 이름)를 누르면 **선택**, 본문(라벨·값 격자)을 누르면 그 매물의 **상세 페이지**(보조 칸)가 열린다.
 * 한 번 고르면 풀리지 않고 다른 카드를 눌러 바꾼다. 못 고르는 매물(이유 있음)은 머리에 선택 동그라미가 없고 이유가 빨간 글씨로 붙는다.
 * 조건과 다른 매물은 머리에 꼬리표, 다른 점이 본문 아래에 보인다. 사진·설명·사양·파일은 상세 페이지에서 본다
 */
function ListingCard({
  option: o,
  line,
  recommended,
  showProduct,
  onChoose,
  onOpenDetail,
}: {
  option: ListingOption;
  line: BuyLine;
  recommended: boolean;
  /** 한 줄에 여러 상품의 매물이 합쳐졌을 때만 — 어느 상품의 매물인지 보인다 */
  showProduct: boolean;
  onChoose: (rowNo: number, sellerId: string, regDate: string) => void;
  onOpenDetail: (sellerId: string, regDate: string) => void;
}) {
  const blocked = o.reason !== null;
  const picked = line.result.chosen?.sellerId === o.sellerId && line.result.chosen.regDate === o.regDate;
  const seller = t.line.seller(o.sellerNickname);
  const qty = Number(line.fields.orderQuantity.replace(/[,\s]/g, ""));
  const total = Number.isInteger(qty) && qty > 0 ? formatPrice(o.unitPrice * qty) : "-";
  const tr = o.traits;
  return (
    <div className={cn("overflow-hidden rounded-md border", picked ? "border-primary" : "border-line", blocked && "opacity-80")}>
      <div className={cn("flex items-center gap-2 px-3 py-2", picked ? "bg-primary-soft" : "bg-bg")}>
        {blocked ? (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-semibold text-ink-3">
            <span className="truncate">{seller}</span>
            <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[12px] font-normal">{t.card.blockedTag}</span>
          </span>
        ) : (
          <button
            type="button"
            aria-pressed={picked}
            aria-label={t.card.pickLabel(seller)}
            disabled={line.checking}
            onClick={() => !picked && onChoose(line.rowNo, o.sellerId, o.regDate)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-semibold text-ink outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-60"
          >
            <span aria-hidden="true" className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] text-white", picked ? "border-primary bg-primary" : "border-line bg-surface")}>
              {picked ? "✓" : ""}
            </span>
            <span className="truncate">{seller}</span>
            {recommended && <span className="shrink-0 rounded bg-green-soft px-1.5 py-0.5 text-[12px] font-bold text-green">{t.group.recommended}</span>}
            {o.mismatches.length > 0 && <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[12px] font-normal text-ink-2">{t.card.mismatchTag}</span>}
            {picked && <span className="ml-auto shrink-0 text-[12px] font-bold text-primary">{t.group.selected}</span>}
          </button>
        )}
      </div>
      <button type="button" onClick={() => onOpenDetail(o.sellerId, o.regDate)} title={t.card.detailHint} className="flex w-full flex-col gap-2 px-3 py-2 text-left hover:bg-bg">
        <span className="grid grid-cols-2 gap-x-3 gap-y-2 @md:grid-cols-3">
          {showProduct && (
            <Field label={t.card.product} className="col-span-2 @md:col-span-3">
              {[o.prodName, o.prodBrand, o.prodClassNo].filter(Boolean).join(" · ")}
            </Field>
          )}
          <Field label={t.card.price}>{formatPrice(o.unitPrice)}</Field>
          <Field label={t.card.total(Number.isInteger(qty) && qty > 0 ? qty : 0)}>{total}</Field>
          <Field label={t.card.stock}>{o.stock}</Field>
          <Field label={t.card.delivery}>{o.deliveryDate ?? "-"}</Field>
          <Field label={t.card.state}>{tr.prodState ?? "-"}</Field>
          <Field label={t.card.warranty}>{t.trait.warranty(tr.warrantyDays)}</Field>
          <Field label={t.card.coverage}>{tr.warrantyCoverage ?? "-"}</Field>
          <Field label={t.card.minOrder}>{o.minOrder}</Field>
          <Field label={t.card.orderUnit}>{o.orderUnit}</Field>
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-2">{t.card.evidence}</span>
          <span className="flex flex-wrap gap-1.5">
            <EvidenceChip name={t.trait.dataSheet} has={tr.hasDataSheet} />
            <EvidenceChip name={t.trait.photo} has={tr.hasPhoto} />
            <EvidenceChip name={t.trait.testReport} has={tr.hasTestReport} />
            <EvidenceChip name={t.trait.certificate} has={tr.hasCertificate} />
          </span>
        </span>
        {o.replaceHint && (
          <span className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-2">{t.card.replace}</span>
            <span className="rounded-md bg-bg px-2 py-1 text-[13px] text-ink-2">{o.replaceHint}</span>
          </span>
        )}
        {o.reason && <span className="text-[12px] text-down">{o.reason}</span>}
        {!blocked &&
          o.mismatches.map((text) => (
            <span key={text} className="text-[12px] text-down">
              {t.option.mismatch(text)}
            </span>
          ))}
      </button>
    </div>
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
  const productProblem = tab === "failed" && line.result.masterCount === 0;
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
