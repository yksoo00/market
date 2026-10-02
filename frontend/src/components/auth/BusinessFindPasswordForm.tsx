"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ResetDone } from "@/components/auth/FindPasswordForm";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { findBusinessPasswordSchema, type FindBusinessPasswordInput } from "@/lib/validation/auth";
import { auth as t } from "@/messages/auth";
import { UNREACHABLE } from "@/types/api";

const fields = ["bizNo", "email"] as const;

/** 기업 회원: 사업자번호 + 담당자 이메일 → 재설정 링크 발송. 링크는 /login/reset-password 로 옴 */
export function BusinessFindPasswordForm() {
  const form = useForm<FindBusinessPasswordInput>({
    resolver: zodResolver(findBusinessPasswordSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { bizNo: "", email: "" },
  });
  const {
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const result = await authApi.requestBusinessPasswordReset(values);
    if (result.ok) {
      setDone(true);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields));
  });

  if (done) return <ResetDone message={t.findPassword.doneBusiness} />;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <FormField<FindBusinessPasswordInput>
          name="bizNo"
          label={t.findPassword.bizNo}
          placeholder={t.login.bizNoPlaceholder}
          inputMode="numeric"
          autoComplete="username"
          maxLength={12}
        />
        <FormField<FindBusinessPasswordInput>
          name="email"
          label={t.findPassword.businessEmail}
          type="email"
          placeholder={t.findPassword.emailPlaceholder}
          autoComplete="email"
          maxLength={254}
        />
        <SubmitButton label={t.findPassword.submitBusiness} disabled={!isValid} submitting={isSubmitting} />
        <p className="text-center text-xs text-ink-3">{t.findPassword.businessContact}</p>
      </form>
    </FormProvider>
  );
}
