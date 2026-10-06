"use client";

import type { ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
import { FieldShell, FormField, useFieldStatus } from "@/components/auth/FormField";
import { MAX_DESCRIPTION, type ListingFormInput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

const t = listing.form;

// 등록 폼과 수정 폼이 같이 쓰는 칸. 칸 이름(salesQuantity·description 등)이 두 폼에서 같아 같은 컴포넌트를 쓴다

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line-2 pt-5 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

/** 2열 배치에서 한 줄 전체를 쓰는 칸 */
export function Wide({ children }: { children: ReactNode }) {
  return <div className="@md:col-span-2">{children}</div>;
}

export function NumberField({ name, label, placeholder }: { name: "salesQuantity" | "stockQuantity" | "minOrderQuantity" | "orderUnit"; label: string; placeholder?: string }) {
  return <FormField<ListingFormInput> inline name={name} label={label} placeholder={placeholder} inputMode="numeric" maxLength={6} className="font-mono tabular-nums" />;
}

export function DescriptionField() {
  const { error, valid, touched } = useFieldStatus<ListingFormInput>("description");
  const { register, control } = useFormContext<ListingFormInput>();
  const value = useWatch({ control, name: "description" });
  return (
    <FieldShell inline label={t.description} htmlFor="description" error={error} note={<span className="text-ink-3">{value.length}/{MAX_DESCRIPTION}</span>}>
      <textarea
        id="description"
        rows={4}
        maxLength={MAX_DESCRIPTION}
        placeholder={t.descriptionPlaceholder}
        aria-invalid={touched && Boolean(error)}
        aria-describedby={error ? "description-error" : undefined}
        {...register("description")}
        className={cn(
          "w-full rounded-md border border-line bg-surface px-3 py-2 text-[15px] outline-none resize-y focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-down",
          valid && "border-up",
        )}
      />
    </FieldShell>
  );
}
