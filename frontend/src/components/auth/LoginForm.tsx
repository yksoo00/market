"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { businessLoginSchema, loginSchema, type BusinessLoginInput, type LoginInput } from "@/lib/validation/auth";
import { auth as t } from "@/messages/auth";
import { UNREACHABLE } from "@/types/api";

interface Props {
  kind: "personal" | "business";
  /** 로그인 후 돌아갈 경로 */
  next: string;
}

// 일반·기업 로그인은 첫 칸(아이디/사업자번호)과 API 만 다름. 폼 상태 처리는 같아서 하나로.
type Values = LoginInput & BusinessLoginInput;
const fields = ["loginId", "bizNo", "password"] as const;
// 두 스키마를 같은 필드 집합으로 맞춰야 resolver 타입이 하나로 잡힘. 안 쓰는 쪽은 검사 안 함
const personalSchema = loginSchema.extend({ bizNo: z.string() });
const businessSchema = businessLoginSchema.extend({ loginId: z.string() });

export function LoginForm({ kind, next }: Props) {
  const router = useRouter();
  const isBusiness = kind === "business";
  const form = useForm<Values>({
    resolver: zodResolver(isBusiness ? businessSchema : personalSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { loginId: "", bizNo: "", password: "", remember: false },
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
      ? await authApi.loginBusiness({ bizNo: values.bizNo, password: values.password, remember: values.remember })
      : await authApi.login({ loginId: values.loginId, password: values.password, remember: values.remember });
    if (result.ok) {
      router.push(next);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields, t.login.errors));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />

        {isBusiness ? (
          <FormField<Values>
            name="bizNo"
            label={t.login.bizNo}
            placeholder={t.login.bizNoPlaceholder}
            inputMode="numeric"
            autoComplete="username"
            maxLength={12}
          />
        ) : (
          <FormField<Values>
            name="loginId"
            label={t.login.loginId}
            placeholder={t.login.loginIdPlaceholder}
            autoComplete="username"
            autoCapitalize="none"
            maxLength={20}
          />
        )}
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
