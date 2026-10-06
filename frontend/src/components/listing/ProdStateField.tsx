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
        // statusClass 를 뒤에 — cn(tailwind-merge)이 뒤쪽을 남겨서, 앞에 두면 border-line 이 통과(초록) 테두리를 지운다.
        // 오류 모양은 Input 과 같게(빨간 테두리 + 링)
        className={cn(
          "w-full rounded-md border border-line outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          statusClass(valid),
        )}
      >
        {/* disabled 가 아니라 hidden: disabled 면 서버 렌더 HTML 에서 브라우저가 '신품'을 먼저 골라 보여 주다 하이드레이션 뒤 바뀐다 */}
        <option value="" hidden>
          {t.prodStatePlaceholder}
        </option>
        {PROD_STATES.map((s) => (
          <option key={s} value={s}>
            {t.prodStateOptions[s]}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
