"use client";

import { useState } from "react";
import Link from "next/link";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { IdentityVerifyButton } from "@/components/auth/IdentityVerifyButton";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { loginIdSchema, resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";
import { auth as t } from "@/messages/auth";
import { UNREACHABLE } from "@/types/api";

const fields = ["loginId", "password", "passwordConfirm"] as const;

/**
 * 일반 회원. 1단계: 아이디 입력 → 본인인증. 2단계: 새 비밀번호. 서버 호출은 마지막 한 번.
 * 인증한 사람이 계정 소유자인지는 서버가 본인인증 CI 로 대조한다. 기업은 BusinessFindPasswordForm.
 */
export function FindPasswordForm() {
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { loginId: "", password: "", passwordConfirm: "" },
  });
  const {
    handleSubmit,
    setError,
    control,
    formState: { isValid, isSubmitting },
  } = form;
  const [token, setToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [done, setDone] = useState(false);

  // 본인인증 버튼은 아이디 칸이 규칙을 통과해야 활성
  const loginId = useWatch({ control, name: "loginId" });
  const idValid = loginIdSchema.safeParse(loginId).success;

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return;
    setFormError(null);
    setUnreachable(false);
    const result = await authApi.resetPassword({ loginId: values.loginId, verificationToken: token, password: values.password });
    if (result.ok) {
      setDone(true);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, fields, t.findPassword.errors));
    // 계정·인증 불일치나 아이디 오류면 아이디를 고쳐 다시 인증해야 하므로 1단계로 되돌림
    if (["NOT_FOUND", "VERIFICATION_MISMATCH"].includes(result.code) || result.fields?.loginId) {
      setToken(null);
    }
  });

  if (done) return <ResetDone message={t.findPassword.done} />;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <FormField<ResetPasswordInput>
          name="loginId"
          label={t.findPassword.loginId}
          placeholder={t.login.loginIdPlaceholder}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={20}
          readOnly={token !== null}
        />

        {token === null ? (
          <IdentityVerifyButton onVerified={setToken} disabled={!idValid} />
        ) : (
          <>
            <p className="flex items-center justify-center gap-1.5 h-11 rounded-md bg-green-soft text-green text-[14px] font-semibold">
              <ShieldCheck size={18} /> {t.verify.done}
            </p>
            <NewPasswordFields />
            <SubmitButton label={t.findPassword.submit} disabled={!isValid} submitting={isSubmitting} />
          </>
        )}
      </form>
    </FormProvider>
  );
}

/** 새 비밀번호 + 확인. 본인인증 재설정과 이메일 링크 재설정 공용 */
export function NewPasswordFields() {
  return (
    <>
      <FormField name="password" label={t.findPassword.newPassword} type="password" autoComplete="new-password" maxLength={32} />
      <FormField
        name="passwordConfirm"
        label={t.findPassword.newPasswordConfirm}
        type="password"
        autoComplete="new-password"
        maxLength={32}
      />
    </>
  );
}

export function ResetDone({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-5">
      <p role="status" className="py-2 text-center text-[14px] leading-relaxed">
        {message}
      </p>
      <Link href="/login" className="h-11 flex items-center justify-center rounded-md bg-primary text-white text-[15px] font-bold hover:bg-primary-dark">
        {t.findPassword.backToLogin}
      </Link>
    </div>
  );
}
