"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { InquiryTextArea } from "@/components/inquiry/InquiryTextArea";
import { createInquiry, updateInquiry } from "@/lib/api/inquiries";
import { applyServerError } from "@/lib/form";
import { inquirySchema, type InquiryFormValues } from "@/lib/validation/inquiry";
import { inquiry as t } from "@/messages/inquiry";
import { UNREACHABLE } from "@/types/api";
import type { InquiryDetail } from "@/types/inquiry";

const fields = ["title", "content"] as const;

interface Props {
  /** 저장(등록·수정)된 글을 넘긴다 */
  onSaved: (saved: InquiryDetail) => void;
  /** 있으면 그 글을 고치는 폼 — 값이 채워져 있고 [취소]가 있다 */
  editing?: { id: string; title: string; content: string; onCancel: () => void };
}

/** 글쓰기·수정 폼. 쓰기는 로그인이 필요하다 — 안 했으면 서버가 401 을 주고 폼 위에 안내한다 */
export function InquiryForm({ onSaved, editing }: Props) {
  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { title: editing?.title ?? "", content: editing?.content ?? "" },
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
    const result = editing ? await updateInquiry(editing.id, values) : await createInquiry(values);
    if (result.ok) {
      if (!editing) reset();
      onSaved(result.data);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    // 5xx·네트워크 오류는 입력값을 지우지 않고 폼 위에 안내한다
    setFormError(
      applyServerError(result, setError, fields, {
        INTERNAL: t.form.failed,
        UNAUTHENTICATED: t.form.loginRequired,
        FORBIDDEN: t.form.forbidden,
      }),
    );
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate aria-label={editing ? t.form.editHeading : t.form.heading} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-[15px] font-bold">{editing ? t.form.editHeading : t.form.heading}</h2>
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <FormField<InquiryFormValues> name="title" label={t.form.title} placeholder={t.form.titlePlaceholder} autoComplete="off" />
        <InquiryTextArea<InquiryFormValues> name="content" label={t.form.content} placeholder={t.form.contentPlaceholder} rows={5} />
        <SubmitButton label={editing ? t.form.save : t.form.submit} disabled={!isValid} submitting={isSubmitting} />
        {editing && (
          <button type="button" onClick={editing.onCancel} className="h-10 rounded-lg border border-line bg-surface text-sm font-medium hover:bg-bg">
            {t.form.cancel}
          </button>
        )}
      </form>
    </FormProvider>
  );
}
