"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NewPasswordFields, ResetDone } from "@/components/auth/FindPasswordForm";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/validation/auth";
import { auth as t } from "@/messages/auth";
import { UNREACHABLE } from "@/types/api";

const fields = ["password", "passwordConfirm"] as const;

/** 이메일 재설정 링크(?token=)로 들어온 새 비밀번호 설정 */
export function ResetPasswordForm({ token }: { token: string }) {
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { password: "", passwordConfirm: "" },
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
    const result = await authApi.confirmPasswordReset({ token, password: values.password });
    if (result.ok) {
      setDone(true);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields, t.resetPassword.errors));
  });

  if (done) return <ResetDone message={t.findPassword.done} />;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <NewPasswordFields />
        <SubmitButton label={t.findPassword.submit} disabled={!isValid} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}
