"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
import { FieldShell, statusClass, useFieldStatus } from "@/components/auth/FormField";
import { USEFUL_LIFE_MONTHS, type ListingFormInput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

const t = listing.form;

const selectClass =
  "w-full rounded-md border border-line outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

/**
 * 보증년수 드롭다운 — 개월 수 3·6·…·60, 안 고르면 없음 (사용자 결정 2026-10-28). 상품 칸이라 마스터를 고르면 잠긴다:
 * select 는 readOnly 가 없어, 잠기면 고른 값을 글자로만 보인다 (disabled 는 폼 값이 undefined 가 돼 스키마를 못 지난다)
 */
export function UsefulLifeField({ locked }: { locked: boolean }) {
  const { register, control } = useFormContext<ListingFormInput>();
  const { error, valid, touched } = useFieldStatus<ListingFormInput>("prodUsefulLife");
  const value = useWatch({ control, name: "prodUsefulLife" });

  return (
    <FieldShell label={t.prodUsefulLife} htmlFor="prodUsefulLife" error={locked ? undefined : error} inline>
      {locked ? (
        <input
          id="prodUsefulLife"
          readOnly
          value={value === "" ? "" : t.usefulLifeMonths(Number(value))}
          placeholder={t.prodUsefulLifePlaceholder}
          className={cn(selectClass, statusClass(false), "bg-bg")}
        />
      ) : (
        <select
          id="prodUsefulLife"
          {...register("prodUsefulLife")}
          aria-invalid={touched && Boolean(error)}
          aria-describedby={error ? "prodUsefulLife-error" : undefined}
          // statusClass 를 뒤에 — ProdStateField 와 같은 이유(통과 테두리를 지우지 않게)
          className={cn(selectClass, statusClass(valid))}
        >
          <option value="">{t.prodUsefulLifePlaceholder}</option>
          {USEFUL_LIFE_MONTHS.map((m) => (
            <option key={m} value={String(m)}>
              {t.usefulLifeMonths(m)}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
