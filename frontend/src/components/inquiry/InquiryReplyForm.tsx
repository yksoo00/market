"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { InquiryTextArea } from "@/components/inquiry/InquiryTextArea";
import { createInquiryReply } from "@/lib/api/inquiries";
import { applyServerError } from "@/lib/form";
import { inquiryReplySchema, type InquiryReplyFormValues } from "@/lib/validation/inquiry";
import { inquiry as t } from "@/messages/inquiry";
import { UNREACHABLE } from "@/types/api";
import type { InquiryReply } from "@/types/inquiry";

const fields = ["content"] as const;

/** 답글 폼. 로그인 없이 쓴다 */
export function InquiryReplyForm({ inquiryId, onCreated }: { inquiryId: string; onCreated: (created: InquiryReply) => void }) {
  const form = useForm<InquiryReplyFormValues>({
    resolver: zodResolver(inquiryReplySchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { content: "" },
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
    const result = await createInquiryReply(inquiryId, values);
    if (result.ok) {
      reset();
      onCreated(result.data);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields, { INTERNAL: t.reply.failed }));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate aria-label={t.reply.content} className="flex flex-col gap-3">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <InquiryTextArea<InquiryReplyFormValues>
          name="content"
          label={t.reply.content}
          placeholder={t.reply.placeholder}
          rows={3}
        />
        <SubmitButton label={t.reply.submit} disabled={!isValid} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}
