"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { errorsOf, type BuyLine } from "@/lib/buyBulk";
import { PROD_STATES } from "@/lib/validation/listing";
import { BUY_CONDITION_FIELDS, BUY_EVIDENCE_FIELDS, WARRANTY_MONTHS, conditionCount, type BuyFields } from "@/lib/validation/buyBulk";
import { buyBulk } from "@/messages/buyBulk";

const t = buyBulk.conditions;

const inputClass =
  "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus-visible:border-primary aria-invalid:border-down disabled:bg-bg disabled:text-ink-3";

interface Props {
  line: BuyLine;
  /** 글자를 치는 칸(단가 상한) — 칠 때마다 묻지 않고 칸을 벗어날 때 그 줄만 다시 검사한다 */
  onEdit: (rowNo: number, field: keyof BuyFields, value: string) => void;
  onBlurLine: (rowNo: number) => void;
  /** 고르는 칸(상태·보증·증빙) — 바꾼 즉시 그 줄을 다시 검사한다 */
  onEditNow: (rowNo: number, field: keyof BuyFields, value: string) => void;
}

/**
 * 줄의 "조건" 구역 (계획 2026-11-09-bulk-purchase-conditions.md). 최소 상태·단가 상한·최소 보증·있어야 하는 서류. 비우면 조건 없음.
 * 조건이 걸려 있으면 처음부터 펼쳐 보이고, 없으면 접어 둔다(줄이 100개라 늘 펼치면 길다). 조건을 어긴 매물은 사유와 함께 회색으로 남는다
 */
export function BuyConditionFields({ line, onEdit, onBlurLine, onEditNow }: Props) {
  const count = conditionCount(line.fields);
  const [open, setOpen] = useState(count > 0);
  const errors = errorsOf(line);
  // 오류가 있는 조건 칸이 접혀 가려지지 않게 — 오류가 있으면 접어도 펼쳐 둔다
  const expanded = open || BUY_CONDITION_FIELDS.some((name) => errors[name]);
  const f = line.fields;
  const disabled = line.added;
  const regionId = `conditions-${line.rowNo}`;

  return (
    <div className="border-t border-line-2 px-3 py-2">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[12px] font-semibold text-ink-2 hover:text-ink"
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        {t.title}
        <span className="rounded bg-bg px-1.5 py-0.5 font-normal text-ink-2">{count > 0 ? t.count(count) : t.none}</span>
      </button>
      {expanded && (
        <div id={regionId} className="mt-2 flex flex-col gap-2">
          <p className="text-[12px] text-ink-3">{t.hint}</p>
          {/* 3분할 오른쪽 아래 같은 좁은 칸에서도 읽히게 2열, 칸이 넓으면 3열 */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 @md:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-ink-2">{t.minState}</span>
              <select
                value={f.minState}
                disabled={disabled}
                aria-invalid={Boolean(errors.minState)}
                className={inputClass}
                onChange={(e) => onEditNow(line.rowNo, "minState", e.target.value)}
              >
                <option value="">{t.minStateAny}</option>
                {PROD_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.minState && <FieldError message={errors.minState} />}
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-ink-2">{t.maxPrice}</span>
              <input
                value={f.maxPrice}
                disabled={disabled}
                inputMode="numeric"
                placeholder={t.maxPricePlaceholder}
                aria-invalid={Boolean(errors.maxPrice)}
                className={inputClass}
                onChange={(e) => onEdit(line.rowNo, "maxPrice", e.target.value)}
                onBlur={() => onBlurLine(line.rowNo)}
              />
              {errors.maxPrice && <FieldError message={errors.maxPrice} />}
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-ink-2">{t.minWarranty}</span>
              <select
                value={f.minWarrantyMonths}
                disabled={disabled}
                aria-invalid={Boolean(errors.minWarrantyMonths)}
                className={inputClass}
                onChange={(e) => onEditNow(line.rowNo, "minWarrantyMonths", e.target.value)}
              >
                <option value="">{t.minWarrantyAny}</option>
                {WARRANTY_MONTHS.map((m) => (
                  <option key={m} value={String(m)}>
                    {t.warrantyMonths(m)}
                  </option>
                ))}
              </select>
              {errors.minWarrantyMonths && <FieldError message={errors.minWarrantyMonths} />}
            </label>
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-[12px] text-ink-2">{t.evidence}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {BUY_EVIDENCE_FIELDS.map((name) => (
                <label key={name} className="flex items-center gap-1.5 text-[13px] text-ink">
                  <Checkbox
                    checked={f[name].trim().toUpperCase() === "Y"}
                    disabled={disabled}
                    onCheckedChange={(checked) => onEditNow(line.rowNo, name, checked === true ? "Y" : "")}
                  />
                  {buyBulk.fields[name]}
                </label>
              ))}
            </div>
            {BUY_EVIDENCE_FIELDS.filter((name) => errors[name]).map((name) => (
              <FieldError key={name} message={`${buyBulk.fields[name]}: ${errors[name]}`} />
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <span role="alert" className="text-[12px] text-down">
      {message}
    </span>
  );
}
