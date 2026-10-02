"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
import { FieldShell, statusClass, useFieldStatus } from "@/components/auth/FormField";
import { Input } from "@/components/ui/input";
import type { ListingFormInput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

const t = listing.form;

/** 상품상태: [신품][중고] + 중고면 "신품대비 __ %". 저장 값은 "신품" 또는 "신품대비 N%" (lib/listingForm) */
export function ProdStateField() {
  const { control, register, setValue } = useFormContext<ListingFormInput>();
  const condition = useWatch({ control, name: "condition" });
  const percent = useFieldStatus<ListingFormInput>("usedPercent");
  // 서버가 prodState 를 거부하면 condition 칸에 오류를 붙인다 (ListingForm)
  const conditionStatus = useFieldStatus<ListingFormInput>("condition");

  return (
    <FieldShell label={t.condition} error={conditionStatus.error ?? (condition === "used" ? percent.error : undefined)}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t.condition} className="grid grid-cols-2 gap-2 w-[180px]">
          {(["new", "used"] as const).map((value) => {
            const selected = condition === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setValue("condition", value, { shouldValidate: true, shouldDirty: true })}
                className={`h-11 rounded-md border text-sm font-medium transition-colors ${selected ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-surface text-ink-2 hover:border-primary"}`}
              >
                {value === "new" ? t.conditionNew : t.conditionUsed}
              </button>
            );
          })}
        </div>
        {condition === "used" && (
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            {t.usedPercentPrefix}
            <Input
              {...register("usedPercent")}
              aria-label={t.usedPercentLabel}
              aria-invalid={percent.touched && Boolean(percent.error)}
              inputMode="numeric"
              maxLength={2}
              className={cn(statusClass(percent.valid), "w-20 font-mono tabular-nums text-right")}
            />
            %
          </label>
        )}
      </div>
    </FieldShell>
  );
}
