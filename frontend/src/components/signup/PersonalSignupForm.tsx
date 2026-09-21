"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { CheckableField } from "@/components/signup/CheckableField";
import { EmailField } from "@/components/signup/EmailField";
import { PhoneField } from "@/components/signup/PhoneField";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { personalSignupFlow, personalSignupPath } from "@/lib/signupFlow";
import { joinEmail, personalSignupSchema, type PersonalSignupInput } from "@/lib/validation/signup";
import { signup as t } from "@/messages/signup";
import { UNREACHABLE } from "@/types/api";

// 서버 fields 오류를 붙일 수 있는 칸. 이메일·휴대폰은 서버 필드명(email, phone)을 폼 칸으로 옮긴다
const fields = ["name", "nickname", "loginId", "emailLocal", "emailCustom", "password", "passwordConfirm", "phoneMid", "phoneLast"] as const;
const serverFieldMap: Record<string, (typeof fields)[number]> = { email: "emailLocal", phone: "phoneMid" };

export function PersonalSignupForm() {
  const router = useRouter();
  const form = useForm<PersonalSignupInput>({
    resolver: zodResolver(personalSignupSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      nickname: "",
      loginId: "",
      emailLocal: "",
      emailDomain: "naver.com",
      emailCustom: "",
      password: "",
      passwordConfirm: "",
      phonePrefix: "010",
      phoneMid: "",
      phoneLast: "",
      marketingOptIn: personalSignupFlow.get().marketingOptIn ?? false,
    },
  });
  const {
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const [checked, setChecked] = useState({ loginId: false, nickname: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const onCheckStatus = useCallback((name: "loginId" | "nickname", available: boolean) => {
    setChecked((c) => (c[name] === available ? c : { ...c, [name]: available }));
  }, []);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setUnreachable(false);
    const { verificationToken } = personalSignupFlow.get();
    if (!verificationToken) {
      router.replace(personalSignupPath.verify);
      return;
    }
    const result = await authApi.signupPersonal({
      verificationToken,
      name: v.name,
      nickname: v.nickname,
      loginId: v.loginId,
      email: joinEmail(v.emailLocal, v.emailDomain, v.emailCustom),
      password: v.password,
      phone: `${v.phonePrefix}${v.phoneMid}${v.phoneLast}`,
      marketingOptIn: v.marketingOptIn,
    });
    if (result.ok) {
      personalSignupFlow.clear();
      router.push(personalSignupPath.done);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    const mapped = result.fields
      ? { ...result, fields: Object.fromEntries(Object.entries(result.fields).map(([k, m]) => [serverFieldMap[k] ?? k, m])) }
      : result;
    setFormError(applyServerError(mapped, setError, fields, t.form.errors));
    // 서버가 아이디·닉네임을 거부하면 그 칸에 오류를 붙이고(중복확인 버튼이 다시 열림) 확인 결과를 무효로
    for (const [code, name] of [["DUPLICATE_LOGIN_ID", "loginId"], ["DUPLICATE_NICKNAME", "nickname"]] as const) {
      if (result.code === code) setError(name, { type: "server", message: t.form.errors[code] });
      if (result.code === code || result.fields?.[name]) setChecked((c) => ({ ...c, [name]: false }));
    }
    if (result.code === "VERIFICATION_EXPIRED") {
      personalSignupFlow.clear();
    }
  });

  const canSubmit = isValid && checked.loginId && checked.nickname;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />

        <FormField<PersonalSignupInput> name="name" label={t.form.name} placeholder={t.form.namePlaceholder} autoComplete="name" maxLength={30} />
        <CheckableField name="nickname" label={t.form.nickname} hint={t.form.nicknameHint} placeholder={t.form.nicknamePlaceholder} maxLength={20} onStatus={onCheckStatus} />
        <CheckableField
          name="loginId"
          label={t.form.loginId}
          hint={t.form.loginIdHint}
          placeholder={t.form.loginIdPlaceholder}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={20}
          onStatus={onCheckStatus}
        />
        <EmailField />
        <FormField<PersonalSignupInput>
          name="password"
          label={t.form.password}
          type="password"
          placeholder={t.form.passwordPlaceholder}
          autoComplete="new-password"
          maxLength={32}
        />
        <FormField<PersonalSignupInput> name="passwordConfirm" label={t.form.passwordConfirm} type="password" autoComplete="new-password" maxLength={32} />
        <PhoneField />

        {!canSubmit && isValid && <p className="text-xs text-ink-3 text-center">{t.form.needCheck}</p>}
        <SubmitButton label={t.form.submit} disabled={!canSubmit} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}
