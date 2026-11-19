"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { InquiryTextArea } from "@/components/inquiry/InquiryTextArea";
import { createInquiryReply, updateInquiryReply } from "@/lib/api/inquiries";
import { applyServerError } from "@/lib/form";
import { inquiryReplySchema, type InquiryReplyFormValues } from "@/lib/validation/inquiry";
import { inquiry as t } from "@/messages/inquiry";
import { UNREACHABLE } from "@/types/api";
import type { InquiryReply } from "@/types/inquiry";

const fields = ["content"] as const;

interface Props {
  inquiryId: string;
  /** 저장(등록·수정)된 답글을 넘긴다 */
  onSaved: (saved: InquiryReply) => void;
  /** 있으면 그 답글을 고치는 폼 */
  editing?: { replyId: string; content: string; onCancel: () => void };
}

/** 답글 등록·수정 폼. 쓰기는 로그인이 필요하다 */
export function InquiryReplyForm({ inquiryId, onSaved, editing }: Props) {
  const form = useForm<InquiryReplyFormValues>({
    resolver: zodResolver(inquiryReplySchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { content: editing?.content ?? "" },
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
    const result = editing ? await updateInquiryReply(inquiryId, editing.replyId, values) : await createInquiryReply(inquiryId, values);
    if (result.ok) {
      if (!editing) reset();
      onSaved(result.data);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(
      applyServerError(result, setError, fields, {
        INTERNAL: t.reply.failed,
        UNAUTHENTICATED: t.reply.loginRequired,
        FORBIDDEN: t.reply.forbidden,
      }),
    );
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate aria-label={t.reply.content} className="flex flex-col gap-3">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <InquiryTextArea<InquiryReplyFormValues> name="content" label={t.reply.content} placeholder={t.reply.placeholder} rows={3} />
        <SubmitButton label={editing ? t.reply.save : t.reply.submit} disabled={!isValid} submitting={isSubmitting} />
        {editing && (
          <button type="button" onClick={editing.onCancel} className="h-10 rounded-lg border border-line bg-surface text-sm font-medium hover:bg-bg">
            {t.reply.cancel}
          </button>
        )}
      </form>
    </FormProvider>
  );
}
