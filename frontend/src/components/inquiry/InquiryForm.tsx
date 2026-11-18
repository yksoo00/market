"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { InquiryTextArea } from "@/components/inquiry/InquiryTextArea";
import { createInquiry } from "@/lib/api/inquiries";
import { applyServerError } from "@/lib/form";
import { inquirySchema, type InquiryFormValues } from "@/lib/validation/inquiry";
import { inquiry as t } from "@/messages/inquiry";
import { UNREACHABLE } from "@/types/api";
import type { InquiryDetail } from "@/types/inquiry";

const fields = ["title", "content"] as const;

/** 글쓰기 폼. 로그인 없이 쓴다 — 등록되면 onCreated 로 만든 글을 넘긴다 */
export function InquiryForm({ onCreated }: { onCreated: (created: InquiryDetail) => void }) {
  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { title: "", content: "" },
  });
  const {
    handleSubmit,
    setError,
    reset,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const result = await createInquiry(values);
    if (result.ok) {
      reset();
      onCreated(result.data);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    // 5xx·네트워크 오류는 입력값을 지우지 않고 폼 위에 안내한다
    setFormError(applyServerError(result, setError, fields, { INTERNAL: t.form.failed }));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate aria-label={t.form.heading} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[15px] font-bold">{t.form.heading}</h2>
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <FormField<InquiryFormValues>
          name="title"
          label={t.form.title}
          placeholder={t.form.titlePlaceholder}
          autoComplete="off"
        />
        <InquiryTextArea<InquiryFormValues>
          name="content"
          label={t.form.content}
          placeholder={t.form.contentPlaceholder}
          rows={5}
        />
        <SubmitButton label={t.form.submit} disabled={!isValid} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}
