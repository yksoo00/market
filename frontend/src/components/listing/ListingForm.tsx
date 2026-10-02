"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import { FieldShell, FormField, useFieldStatus } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { ProdStateField } from "@/components/listing/ProdStateField";
import { applyServerError } from "@/lib/form";
import { formatPrice } from "@/lib/format";
import { todayInSeoul } from "@/lib/listingForm";
import { listingFormSchema, type ListingFormInput, type ListingFormOutput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";
import { UNREACHABLE, type ApiResult } from "@/types/api";
import type { ListingCreated } from "@/types/listing";

const t = listing.form;

// 서버 fields 를 붙일 수 있는 칸. 서버 필드명 = 요청 필드명이고, prodState 만 폼 칸(condition)으로 옮긴다
const fields = [
  "categoryCode", "prodName", "prodBrand", "prodNo", "prodMufcDate", "prodSpecInfo", "condition", "usedPercent",
  "salesUnitPrice", "salesQuantity", "stockQuantity", "minOrderQuantity", "orderUnit", "deliveryDate", "description",
  "photos", "listingDataSheet",
] as const;
const serverFieldMap: Record<string, (typeof fields)[number]> = { prodState: "condition" };

interface Props {
  initialValues: ListingFormInput;
  submitLabel: string;
  /** 등록·수정 화면이 각자 API 를 넘긴다 (수정 화면 재사용 대비) */
  onSubmit: (values: ListingFormOutput) => Promise<ApiResult<ListingCreated>>;
}

/** 매물 등록 폼. 규격은 design.md "매물 등록 폼", 스펙 docs/superpowers/specs/2026-10-02-listing-create-design.md */
export function ListingForm({ initialValues, submitLabel, onSubmit }: Props) {
  const router = useRouter();
  // 제조일·납기일 범위 기준. 폼을 연 날 기준으로 고정 (자정을 넘겨도 서버가 다시 본다)
  const [today] = useState(() => todayInSeoul());
  const form = useForm<ListingFormInput, unknown, ListingFormOutput>({
    resolver: zodResolver(listingFormSchema(today)),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: initialValues,
  });
  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const price = useWatch({ control, name: "salesUnitPrice" });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const result = await onSubmit(values);
    if (result.ok) {
      router.push(`/listings/${result.data.userId}/${result.data.regDate}`);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    const mapped = result.fields
      ? { ...result, fields: Object.fromEntries(Object.entries(result.fields).map(([k, m]) => [serverFieldMap[k] ?? k, m])) }
      : result;
    setFormError(applyServerError(mapped, setError, fields, listing.errors));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <FormError message={formError} onRetry={unreachable ? () => void submit() : undefined} />

        <Section title={t.sectionProduct}>
          <FormField<ListingFormInput> name="categoryCode" label={t.categoryCode} hint={t.categoryHint} placeholder={t.categoryPlaceholder} maxLength={10} />
          <FormField<ListingFormInput> name="prodBrand" label={t.prodBrand} placeholder={t.prodBrandPlaceholder} maxLength={50} />
          <Wide>
            <FormField<ListingFormInput> name="prodName" label={t.prodName} placeholder={t.prodNamePlaceholder} maxLength={50} />
          </Wide>
          <FormField<ListingFormInput> name="prodNo" label={t.prodNo} placeholder={t.prodNoPlaceholder} maxLength={20} className="font-mono" />
          <FormField<ListingFormInput> name="prodMufcDate" label={t.prodMufcDate} type="date" max={today} />
          <Wide>
            <FormField<ListingFormInput> name="prodSpecInfo" label={t.prodSpecInfo} placeholder={t.prodSpecInfoPlaceholder} maxLength={100} />
          </Wide>
        </Section>

        <Section title={t.sectionSale}>
          <Wide>
            <ProdStateField />
          </Wide>
          <FormField<ListingFormInput>
            name="salesUnitPrice"
            label={t.salesUnitPrice}
            inputMode="numeric"
            maxLength={10}
            className="font-mono tabular-nums"
            note={/^\d+$/.test(price) ? <span className="text-ink-3">{t.price(formatPrice(Number(price)))}</span> : undefined}
          />
          <NumberField name="salesQuantity" label={t.salesQuantity} />
          <NumberField name="stockQuantity" label={t.stockQuantity} placeholder={t.stockQuantityPlaceholder} />
          <NumberField name="minOrderQuantity" label={t.minOrderQuantity} placeholder={t.defaultOne} />
          <NumberField name="orderUnit" label={t.orderUnit} placeholder={t.defaultOne} />
          <FormField<ListingFormInput> name="deliveryDate" label={t.deliveryDate} type="date" min={today} />
        </Section>

        <Section title={t.sectionDetail}>
          <Wide>
            <DescriptionField />
          </Wide>
        </Section>

        <SubmitButton label={submitLabel} disabled={!isValid} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line-2 pt-5 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

/** 2열 배치에서 한 줄 전체를 쓰는 칸 */
function Wide({ children }: { children: ReactNode }) {
  return <div className="@md:col-span-2">{children}</div>;
}

function NumberField({ name, label, placeholder }: { name: "salesQuantity" | "stockQuantity" | "minOrderQuantity" | "orderUnit"; label: string; placeholder?: string }) {
  return <FormField<ListingFormInput> name={name} label={label} placeholder={placeholder} inputMode="numeric" maxLength={6} className="font-mono tabular-nums" />;
}

function DescriptionField() {
  const { error, valid, touched } = useFieldStatus<ListingFormInput>("description");
  const { register, control } = useFormContext<ListingFormInput>();
  const value = useWatch({ control, name: "description" });
  return (
    <FieldShell label={t.description} htmlFor="description" error={error} note={<span className="text-ink-3">{value.length}/200</span>}>
      <textarea
        id="description"
        rows={4}
        maxLength={200}
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
