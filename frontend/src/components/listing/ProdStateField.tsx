"use client";

import { useFormContext } from "react-hook-form";
import { cn } from "cn";
import { FieldShell, statusClass, useFieldStatus } from "@/components/auth/FormField";
import { PROD_STATES, type ListingFormInput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

const t = listing.form;

/** 상품상태 드롭다운. 고른 값이 그대로 저장 값 (PROD_STATES, 백엔드 PROD_STATE_PATTERN 과 같은 목록) */
export function ProdStateField() {
  const { register } = useFormContext<ListingFormInput>();
  const { error, valid, touched } = useFieldStatus<ListingFormInput>("prodState");

  return (
    <FieldShell label={t.prodState} htmlFor="prodState" error={error} inline>
      <select
        id="prodState"
        {...register("prodState")}
        aria-invalid={touched && Boolean(error)}
        aria-describedby={error ? "prodState-error" : undefined}
        className={cn(
          statusClass(valid),
          "w-full rounded-md border border-line outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-down",
        )}
      >
        <option value="" disabled>
          {t.prodStatePlaceholder}
        </option>
        {PROD_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
