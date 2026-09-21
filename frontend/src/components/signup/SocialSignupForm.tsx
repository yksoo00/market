"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { CheckableField } from "@/components/signup/CheckableField";
import { optionalAgreed, requiredAgreed, TermsList } from "@/components/signup/TermsForm";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { socialSignupSchema, type SocialSignupInput } from "@/lib/validation/signup";
import { signup as t } from "@/messages/signup";
import { socialTerms } from "@/messages/terms";
import { UNREACHABLE } from "@/types/api";

interface Props {
  /** OAuth 콜백이 넘겨준 임시 토큰 */
  token: string;
  /** 소셜 프로필 이름. 닉네임 기본값 */
  suggestedNickname: string;
  /** 가입 후 돌아갈 경로 */
  next: string;
}

const m = t.social;

/** 소셜 첫 로그인: 약관 + 닉네임을 한 화면에서. 본인인증·이름·휴대폰 없음 (decisions.md 2026-09-21) */
export function SocialSignupForm({ token, suggestedNickname, next }: Props) {
  const router = useRouter();
  const form = useForm<SocialSignupInput>({
    resolver: zodResolver(socialSignupSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { nickname: suggestedNickname.slice(0, 20) },
  });
  const {
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [nicknameOk, setNicknameOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const onCheckStatus = useCallback((_: "loginId" | "nickname", available: boolean) => setNicknameOk(available), []);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setUnreachable(false);
    const result = await authApi.completeSocialSignup({
      token,
      nickname: v.nickname,
      marketingOptIn: Boolean(optionalAgreed(socialTerms, checked).marketing),
    });
    if (result.ok) {
      router.replace(next);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, ["nickname"], m.errors));
    // 서버가 닉네임을 거부하면 그 칸에 오류를 붙이고(중복확인 버튼이 다시 열림) 확인 결과를 무효로
    if (result.code === "DUPLICATE_NICKNAME") setError("nickname", { type: "server", message: m.errors.DUPLICATE_NICKNAME });
    if (result.code === "DUPLICATE_NICKNAME" || result.fields?.nickname) setNicknameOk(false);
  });

  const canSubmit = isValid && nicknameOk && requiredAgreed(socialTerms, checked);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />
        <TermsList items={socialTerms} checked={checked} onChange={setChecked} />
        <CheckableField
          name="nickname"
          label={m.nickname}
          hint={m.nicknameHint}
          placeholder={t.form.nicknamePlaceholder}
          maxLength={20}
          onStatus={onCheckStatus}
        />
        {isValid && !nicknameOk && <p className="text-xs text-ink-3 text-center">{t.form.needCheck}</p>}
        <SubmitButton label={m.submit} disabled={!canSubmit} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}
