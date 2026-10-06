"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import { FieldShell, FormField, useFieldStatus } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { DatasheetUploader } from "@/components/listing/DatasheetUploader";
import { PhotoUploader } from "@/components/listing/PhotoUploader";
import { ProdStateField } from "@/components/listing/ProdStateField";
import { applyServerError } from "@/lib/form";
import { formatPrice } from "@/lib/format";
import { todayInSeoul } from "@/lib/listingForm";
import { listingFormSchema, MAX_DESCRIPTION, type ListingFormInput, type ListingFormOutput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";
import { UNREACHABLE, type ApiResult } from "@/types/api";
import type { ListingCreated } from "@/types/listing";

const t = listing.form;

// 서버 fields 를 붙일 수 있는 칸. 서버 필드명 = 요청 필드명 = 폼 칸 이름
const fields = [
  "categoryCode", "prodName", "prodBrand", "prodNo", "prodMufcDate", "prodSpecInfo", "prodState",
  "salesUnitPrice", "salesQuantity", "stockQuantity", "minOrderQuantity", "orderUnit", "deliveryDate", "description",
  "photos", "listingDataSheet",
] as const;

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
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: initialValues,
  });
  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting, errors },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const price = useWatch({ control, name: "salesUnitPrice" });
  const photos = useWatch({ control, name: "photos" });
  const datasheet = useWatch({ control, name: "listingDataSheet" });
  const [photosUploading, setPhotosUploading] = useState(false);
  const [datasheetUploading, setDatasheetUploading] = useState(false);
  // 업로더의 effect 의존성이라 참조가 바뀌지 않게 (바뀌면 렌더마다 effect 가 다시 돈다)
  const setPhotos = useCallback((keys: string[]) => form.setValue("photos", keys, { shouldValidate: true, shouldDirty: true }), [form]);
  const setDatasheet = useCallback(
    (key: string) => form.setValue("listingDataSheet", key, { shouldValidate: true, shouldDirty: true }),
    [form],
  );

  const uploading = photosUploading || datasheetUploading;
  // 성공 후 이동하는 동안 버튼을 계속 막는다. 다시 눌려도 같은 Idempotency-Key 라 서버가 새로 만들지 않지만 요청을 아끼고 이동을 흔들지 않게
  const [done, setDone] = useState(false);

  // 최소주문량 ≤ 판매수량은 두 칸에 걸친 규칙인데, blur 검사는 blur 한 칸의 오류만 갱신한다.
  // 판매수량이 바뀌면 최소주문량 오류도 다시 계산해야 "버튼은 꺼졌는데 오류 문구가 없는" 상태가 안 생긴다
  const salesQuantity = useWatch({ control, name: "salesQuantity" });
  useEffect(() => {
    const { isTouched } = form.getFieldState("minOrderQuantity");
    if (isTouched || form.formState.isSubmitted) void form.trigger("minOrderQuantity");
  }, [salesQuantity, form]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const result = await onSubmit(values);
    if (result.ok) {
      setDone(true);
      router.push(`/listings/${result.data.userId}/${result.data.regDate}`);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields, listing.errors));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {/* 다시 시도도 [등록]과 같은 조건 — 업로드 중이면 키가 없어 사진이 빠진다 */}
        <FormError message={formError} onRetry={unreachable && !uploading && !isSubmitting ? () => void submit() : undefined} />

        <Section title={t.sectionProduct}>
          <FormField<ListingFormInput> inline name="categoryCode" label={t.categoryCode} hint={t.categoryHint} placeholder={t.categoryPlaceholder} maxLength={10} />
          <FormField<ListingFormInput> inline name="prodBrand" label={t.prodBrand} placeholder={t.prodBrandPlaceholder} maxLength={50} />
          <Wide>
            <FormField<ListingFormInput> inline name="prodName" label={t.prodName} placeholder={t.prodNamePlaceholder} maxLength={50} />
          </Wide>
          <FormField<ListingFormInput> inline name="prodNo" label={t.prodNo} placeholder={t.prodNoPlaceholder} maxLength={20} className="font-mono" />
          <FormField<ListingFormInput> inline name="prodMufcDate" label={t.prodMufcDate} type="date" max={today} />
          <Wide>
            <FormField<ListingFormInput> inline name="prodSpecInfo" label={t.prodSpecInfo} placeholder={t.prodSpecInfoPlaceholder} maxLength={100} />
          </Wide>
        </Section>

        <Section title={t.sectionSale}>
          <ProdStateField />
          <FormField<ListingFormInput>
            inline
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
          <FormField<ListingFormInput> inline name="deliveryDate" label={t.deliveryDate} type="date" min={today} />
        </Section>

        <Section title={t.sectionDetail}>
          <Wide>
            <DescriptionField />
          </Wide>
          <Wide>
            <PhotoUploader value={photos} onChange={setPhotos} onUploadingChange={setPhotosUploading} error={errors.photos?.message} />
          </Wide>
          <Wide>
            <DatasheetUploader value={datasheet} onChange={setDatasheet} onUploadingChange={setDatasheetUploading} error={errors.listingDataSheet?.message} />
          </Wide>
        </Section>

        {/* 업로드 중엔 키가 아직 없어 제출하면 사진이 빠진다 → 막는다 */}
        <SubmitButton label={submitLabel} disabled={!isValid || uploading || done} submitting={isSubmitting} />
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
  return <FormField<ListingFormInput> inline name={name} label={label} placeholder={placeholder} inputMode="numeric" maxLength={6} className="font-mono tabular-nums" />;
}

function DescriptionField() {
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
