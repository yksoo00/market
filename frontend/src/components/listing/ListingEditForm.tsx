"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { DescriptionField, NumberField, Section, Wide } from "@/components/listing/ListingFormFields";
import { PhotoUploader } from "@/components/listing/PhotoUploader";
import { ProdStateField } from "@/components/listing/ProdStateField";
import { SingleFileUploader } from "@/components/listing/SingleFileUploader";
import { listingsApi } from "@/lib/api/listings";
import { applyServerError } from "@/lib/form";
import { formatPrice } from "@/lib/format";
import { diffToUpdateRequest, editInitialValues, type ListingEditValues } from "@/lib/listingEdit";
import { todayInSeoul } from "@/lib/listingForm";
import { listingEditSchema } from "@/lib/validation/listingEdit";
import { listing } from "@/messages/listing";
import { UNREACHABLE } from "@/types/api";
import type { ListingDetail } from "@/types/listing";

const t = listing.form;
const e = listing.edit;

// 서버 fields 를 붙일 수 있는 칸. 서버 필드명 = 요청 필드명 = 폼 칸 이름
const fields = [
  "prodState", "salesUnitPrice", "salesQuantity", "stockQuantity", "minOrderQuantity", "orderUnit", "deliveryDate",
  "description", "photos", "listingDataSheet",
] as const;

/** 매물 수정 폼. 처음 값과 달라진 칸만 PATCH 로 보낸다 (스펙 docs/superpowers/specs/2026-10-06-listing-edit-extra-design.md) */
export function ListingEditForm({ detail }: { detail: ListingDetail }) {
  const router = useRouter();
  const initial = useMemo(() => editInitialValues(detail), [detail]);
  // 납기일 범위의 "오늘". 폼을 연 날 기준으로 고정 (자정을 넘겨도 서버가 다시 본다)
  const [today] = useState(() => todayInSeoul());
  const form = useForm<ListingEditValues>({
    resolver: zodResolver(listingEditSchema(today, initial.deliveryDate)),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: initial,
  });
  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting, errors },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [datasheetUploading, setDatasheetUploading] = useState(false);
  // 성공 후 이동하는 동안 버튼을 계속 막는다 (다시 눌러도 바뀐 칸이 같아 무해하지만 요청을 아낀다)
  const [done, setDone] = useState(false);

  const current = useWatch({ control }) as ListingEditValues;
  const changed = Object.keys(diffToUpdateRequest(initial, current)).length > 0;
  const price = current.salesUnitPrice;
  const photos = current.photos;
  const datasheet = current.listingDataSheet;
  const uploading = photosUploading || datasheetUploading;

  // 업로더의 effect 의존성이라 참조가 바뀌지 않게
  const setPhotos = useCallback((keys: string[]) => form.setValue("photos", keys, { shouldValidate: true, shouldDirty: true }), [form]);
  const setDatasheet = useCallback(
    (key: string) => form.setValue("listingDataSheet", key, { shouldValidate: true, shouldDirty: true }),
    [form],
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const patch = diffToUpdateRequest(initial, values);
    if (Object.keys(patch).length === 0) return;
    const result = await listingsApi.update(detail.userId, detail.regDate, patch);
    if (result.ok) {
      setDone(true);
      router.push(`/listings/${detail.userId}/${detail.regDate}`);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields, listing.errors));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {/* 다시 시도도 [저장]과 같은 조건 */}
        <FormError message={formError} onRetry={unreachable && !uploading && !isSubmitting ? () => void submit() : undefined} />

        <ReadonlyProduct detail={detail} />

        <Section title={e.sectionSale}>
          <ProdStateField />
          <FormField<ListingEditValues>
            inline
            name="salesUnitPrice"
            label={t.salesUnitPrice}
            inputMode="numeric"
            maxLength={10}
            className="font-mono tabular-nums"
            note={/^\d+$/.test(price) ? <span className="text-ink-3">{t.price(formatPrice(Number(price)))}</span> : undefined}
          />
          <NumberField name="salesQuantity" label={t.salesQuantity} />
          <NumberField name="stockQuantity" label={t.stockQuantity} />
          <NumberField name="minOrderQuantity" label={t.minOrderQuantity} />
          <NumberField name="orderUnit" label={t.orderUnit} />
          <FormField<ListingEditValues> inline name="deliveryDate" label={t.deliveryDate} type="date" min={today} />
        </Section>

        <Section title={e.sectionDetail}>
          <Wide>
            <DescriptionField />
          </Wide>
          <Wide>
            <PhotoUploader
              value={photos}
              initialKeys={initial.photos}
              onChange={setPhotos}
              onUploadingChange={setPhotosUploading}
              error={errors.photos?.message}
            />
          </Wide>
          <Wide>
            <SingleFileUploader
              uploadKind="listing-datasheet"
              checkKind="pdf"
              label={t.datasheet}
              hint={t.datasheetHint}
              pickLabel={t.datasheetPick}
              removeLabel={t.datasheetRemove}
              value={datasheet}
              initialKey={initial.listingDataSheet || undefined}
              onChange={setDatasheet}
              onUploadingChange={setDatasheetUploading}
              error={errors.listingDataSheet?.message}
            />
          </Wide>
        </Section>

        {!changed && !done && <p className="-mb-3 text-center text-xs text-ink-3">{e.noChange}</p>}
        {/* 바꾼 칸이 없거나 업로드 중이면 막는다 — 업로드 중엔 키가 아직 없어 사진이 빠진다 */}
        <SubmitButton label={e.save} disabled={!isValid || !changed || uploading || done} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}

/** 상품마스터 칸은 서버가 수정을 받지 않는다 (다른 판매자 매물과 공유) — 읽기 전용으로 보여 준다 */
function ReadonlyProduct({ detail }: { detail: ListingDetail }) {
  const r = e.rows;
  const rows: [string, string | null][] = [
    [r.category, detail.category],
    [r.name, detail.prodName],
    [r.brand, detail.prodBrand],
    [r.prodNo, detail.prodNo],
    [r.mufcDate, detail.mufcDate],
    [r.spec, detail.prodSpecInfo],
  ];
  return (
    <section className="flex flex-col gap-3 border-b border-line-2 pb-5">
      <h2 className="text-[15px] font-bold">
        {e.readonlyTitle}
        <span className="font-normal text-ink-3">{e.readonlyHint}</span>
      </h2>
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-2">{label}</dt>
            <dd className={value ? "text-ink break-words" : "text-ink-3"}>{value ?? listing.detail.empty}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
