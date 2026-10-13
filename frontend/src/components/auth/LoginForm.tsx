"use client";

import { useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { useGoAfterLogin } from "@/hooks/useGoAfterLogin";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { auth as t } from "@/messages/auth";
import { UNREACHABLE } from "@/types/api";

interface Props {
  kind: "personal" | "business";
  /** 로그인 후 돌아갈 경로 */
  next: string;
}

// 일반·기업 로그인은 칸이 같고(아이디·비밀번호, 2026-10-13 기업도 아이디) API 만 다름
type Values = LoginInput;
const fields = ["loginId", "password"] as const;

export function LoginForm({ kind, next }: Props) {
  const goAfterLogin = useGoAfterLogin();
  const isBusiness = kind === "business";
  const form = useForm<Values>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { loginId: "", password: "", remember: false },
  });
  const {
    handleSubmit,
    setError,
    control,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const result = isBusiness
      ? await authApi.loginBusiness({ loginId: values.loginId, password: values.password, remember: values.remember })
      : await authApi.login({ loginId: values.loginId, password: values.password, remember: values.remember });
    if (result.ok) {
      goAfterLogin(next);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields, t.login.errors));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />

        <FormField<Values>
          name="loginId"
          label={t.login.loginId}
          placeholder={t.login.loginIdPlaceholder}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={20}
        />
        <FormField<Values>
          name="password"
          label={t.login.password}
          type="password"
          placeholder={t.login.passwordPlaceholder}
          autoComplete="current-password"
          maxLength={32}
        />

        <Controller
          control={control}
          name="remember"
          render={({ field }) => (
            <Label htmlFor="remember" className="gap-2 text-[13px] text-ink-2 font-normal cursor-pointer">
              <Checkbox id="remember" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              {t.login.remember}
            </Label>
          )}
        />

        <SubmitButton label={t.login.submit} disabled={!isValid} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}
