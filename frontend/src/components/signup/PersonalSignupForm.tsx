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
const fields = ["name", "nickname", "nicknameUsage", "loginId", "emailLocal", "emailCustom", "password", "passwordConfirm", "phoneMid", "phoneLast", "tel", "address"] as const;
const serverFieldMap: Record<string, (typeof fields)[number]> = { email: "emailLocal", phone: "phoneMid" };

export function PersonalSignupForm() {
  const router = useRouter();
  const form = useForm<PersonalSignupInput>({
    resolver: zodResolver(personalSignupSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      nickname: "",
      nicknameUsage: "Y",
      loginId: "",
      emailLocal: "",
      emailDomain: "naver.com",
      emailCustom: "",
      password: "",
      passwordConfirm: "",
      phonePrefix: "010",
      phoneMid: "",
      phoneLast: "",
      tel: "",
      address: "",
      contactMethod: "1",
    },
  });
  const {
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const nicknameUsage = form.watch("nicknameUsage");
  const contactMethod = form.watch("contactMethod");
  const [checked, setChecked] = useState({ loginId: false, nickname: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const onCheckStatus = useCallback((name: "loginId" | "nickname", available: boolean) => {
    setChecked((c) => (c[name] === available ? c : { ...c, [name]: available }));
  }, []);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setUnreachable(false);
    const result = await authApi.signupPersonal({
      name: v.name,
      nickname: v.nicknameUsage === "Y" ? v.nickname : null,
      nicknameUsage: v.nicknameUsage,
      loginId: v.loginId,
      email: joinEmail(v.emailLocal, v.emailDomain, v.emailCustom),
      password: v.password,
      phone: `${v.phonePrefix}${v.phoneMid}${v.phoneLast}`,
      tel: v.tel,
      address: v.address,
      contactMethod: v.contactMethod,
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
  });

  const canSubmit = isValid && checked.loginId && (nicknameUsage === "N" || checked.nickname);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />

        <FormField<PersonalSignupInput> name="name" label={t.form.name} placeholder={t.form.namePlaceholder} autoComplete="name" maxLength={30} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-medium text-ink">{t.form.nicknameUsage}</legend>
          <div role="group" aria-label={t.form.nicknameUsage} className="grid grid-cols-2 gap-2">
            {(["Y", "N"] as const).map((value) => {
              const selected = nicknameUsage === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    form.setValue("nicknameUsage", value, { shouldValidate: true, shouldDirty: true });
                    setChecked((current) => ({ ...current, nickname: value === "N" }));
                  }}
                  className={`h-11 rounded-md border text-sm font-medium transition-colors ${selected ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2 hover:border-primary"}`}
                >
                  {value === "Y" ? t.form.nicknameUse : t.form.nicknameSkip}
                </button>
              );
            })}
          </div>
        </fieldset>
        {nicknameUsage === "Y" && <CheckableField name="nickname" label={t.form.nickname} hint={t.form.nicknameHint} placeholder={t.form.nicknamePlaceholder} maxLength={20} onStatus={onCheckStatus} />}
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
        <FormField<PersonalSignupInput> name="tel" label={t.form.tel} placeholder={t.form.telPlaceholder} autoComplete="tel" maxLength={20} />
        <FormField<PersonalSignupInput> name="address" label={t.form.address} placeholder={t.form.addressPlaceholder} autoComplete="street-address" maxLength={200} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-medium text-ink">{t.form.contactMethod}</legend>
          <div role="group" aria-label={t.form.contactMethod} className="grid grid-cols-3 gap-2">
            {([["1", t.form.contactMethods.all], ["2", t.form.contactMethods.phone], ["3", t.form.contactMethods.email]] as const).map(([value, label]) => {
              const selected = contactMethod === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => form.setValue("contactMethod", value, { shouldValidate: true, shouldDirty: true })}
                  className={`h-11 rounded-md border text-sm font-medium transition-colors ${selected ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2 hover:border-primary"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {!canSubmit && isValid && <p className="text-xs text-ink-3 text-center">{t.form.needCheck}</p>}
        <SubmitButton label={t.form.submit} disabled={!canSubmit} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}
