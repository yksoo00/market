"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { termsDocs, type TermsDocId } from "@/messages/terms";
import { signup as t } from "@/messages/signup";

/** 이 컴포넌트를 쓰는 폼이 가져야 하는 칸. 서버 요청 필드명과 같다 */
export interface TermsFields {
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

const rows: Record<"personal" | "business", { field: keyof TermsFields; doc: TermsDocId }[]> = {
  personal: [
    { field: "agreeTerms", doc: "termsPersonal" },
    { field: "agreePrivacy", doc: "privacy" },
  ],
  business: [
    { field: "agreeTerms", doc: "termsBusiness" },
    { field: "agreePrivacy", doc: "privacy" },
  ],
};

/** 가입 직전 약관 동의 (사용자 지시, 2026-10-13). 각 약관은 [보기]로 펼쳐 읽는다 */
export function TermsAgreement({ kind }: { kind: "personal" | "business" }) {
  const { control, setValue, getFieldState, formState } = useFormContext<TermsFields>();
  const values = useWatch({ control, name: ["agreeTerms", "agreePrivacy"] });
  const [openDoc, setOpenDoc] = useState<TermsDocId | null>(null);
  const items = rows[kind];
  const allChecked = values.every(Boolean);

  const set = (field: keyof TermsFields, checked: boolean) =>
    setValue(field, checked, { shouldValidate: true, shouldDirty: true, shouldTouch: true });

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3.5">
      <legend className="px-1 text-[13px] font-bold">{t.terms.title}</legend>
      <Label className="gap-2 pb-2 border-b border-line-2 text-[14px] font-bold cursor-pointer">
        <Checkbox checked={allChecked} onCheckedChange={(v) => items.forEach((i) => set(i.field, v === true))} />
        {t.terms.all}
      </Label>
      {items.map(({ field, doc }, index) => {
        const error = getFieldState(field, formState).error?.message;
        const isOpen = openDoc === doc;
        return (
          <div key={field} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label className="grow gap-2 text-[13px] font-normal cursor-pointer">
                <Checkbox
                  id={field}
                  checked={values[index]}
                  aria-invalid={Boolean(error)}
                  onCheckedChange={(v) => set(field, v === true)}
                />
                <span>
                  <span className="text-primary font-semibold">{t.terms.required}</span> {termsDocs[doc].title}
                </span>
              </Label>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`terms-${doc}`}
                onClick={() => setOpenDoc(isOpen ? null : doc)}
                className="shrink-0 text-xs text-ink-2 underline underline-offset-2 hover:text-primary"
              >
                {isOpen ? t.terms.hide : t.terms.view}
              </button>
            </div>
            {isOpen && (
              <div
                id={`terms-${doc}`}
                tabIndex={0}
                className="max-h-48 overflow-y-auto rounded-md bg-bg px-3 py-2.5 text-xs leading-relaxed text-ink-2 whitespace-pre-line"
              >
                {termsDocs[doc].body}
              </div>
            )}
            {error && (
              <p role="alert" className="text-xs text-down">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
