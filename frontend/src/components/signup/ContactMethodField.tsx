"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { FieldShell } from "@/components/auth/FormField";
import { signup as t } from "@/messages/signup";

/** 이 컴포넌트를 쓰는 폼이 가져야 하는 칸. 일반·기업 가입 공용 (users.contact_method: 1 전체, 2 휴대폰, 3 이메일) */
export interface ContactMethodFields {
  contactMethod: "1" | "2" | "3";
}

const options = [
  ["1", t.form.contactMethods.all],
  ["2", t.form.contactMethods.phone],
  ["3", t.form.contactMethods.email],
] as const;

/** 연락 수단: 세 칸 토글 */
export function ContactMethodField() {
  const { control, setValue } = useFormContext<ContactMethodFields>();
  const value = useWatch({ control, name: "contactMethod" });
  return (
    <FieldShell label={t.form.contactMethod} inline="narrow">
      <div role="group" aria-label={t.form.contactMethod} className="grid grid-cols-3 gap-2">
        {options.map(([option, label]) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setValue("contactMethod", option, { shouldValidate: true, shouldDirty: true })}
              className={`h-11 rounded-md border text-sm font-medium transition-colors ${selected ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2 hover:border-primary"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
