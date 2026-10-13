"use client";

import { useCallback, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FieldShell, FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/FormStatus";
import { IdentityVerifyButton } from "@/components/auth/IdentityVerifyButton";
import { ResultDialog } from "@/components/common/ResultDialog";
import { AddressField } from "@/components/signup/AddressField";
import { CheckableField } from "@/components/signup/CheckableField";
import { EmailField } from "@/components/signup/EmailField";
import { PhoneField } from "@/components/signup/PhoneField";
import { TermsAgreement } from "@/components/signup/TermsAgreement";
import { useSignupResult } from "@/hooks/useSignupResult";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { joinAddress } from "@/lib/postcode";
import { joinEmail, personalSignupSchema, type PersonalSignupInput } from "@/lib/validation/signup";
import { signup as t } from "@/messages/signup";
import { UNREACHABLE } from "@/types/api";

// 서버 fields 오류를 붙일 수 있는 칸. 이메일·휴대폰은 서버 필드명(email, phone)을 폼 칸으로 옮긴다
const fields = [
  "name", "nickname", "nicknameUsage", "loginId", "emailLocal", "emailCustom", "password", "passwordConfirm",
  "phoneMid", "phoneLast", "tel", "address", "addressDetail", "agreeTerms", "agreePrivacy",
] as const;
const serverFieldMap: Record<string, (typeof fields)[number]> = { email: "emailLocal", phone: "phoneMid" };

// 칸 순서·배치는 사용자 지시 (2026-10-13): 본인인증 → 이름·아이디·이메일·비밀번호·연락처 → 별명 → 주소·연락 수단 → 약관.
// 라벨은 입력 왼쪽(inline="narrow", 휴대폰 폭에선 위로)
export function PersonalSignupForm() {
  const form = useForm<PersonalSignupInput>({
    resolver: zodResolver(personalSignupSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      nickname: "",
      nicknameUsage: "N",
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
      addressDetail: "",
      contactMethod: "1",
      agreeTerms: false,
      agreePrivacy: false,
    },
  });
  const {
    handleSubmit,
    setError,
    control,
    formState: { isValid, isSubmitting },
  } = form;
  const [nicknameUsage, contactMethod, agreeTerms, agreePrivacy] = useWatch({ control, name: ["nicknameUsage", "contactMethod", "agreeTerms", "agreePrivacy"] });
  // TODO(본인인증 업체 계약 전): 화면에서만 확인한다. 서버는 아직 인증 토큰을 받지 않는다 (decisions.md 2026-10-13)
  const [verified, setVerified] = useState(false);
  const [checked, setChecked] = useState({ loginId: false, nickname: false });
  const { showSuccess, showFailure, dialogProps } = useSignupResult("personal");

  const onCheckStatus = useCallback((name: "loginId" | "nickname", available: boolean) => {
    setChecked((c) => (c[name] === available ? c : { ...c, [name]: available }));
  }, []);

  const onSubmit = handleSubmit(async (v) => {
    const res = await authApi.signupPersonal({
      name: v.name,
      nickname: v.nicknameUsage === "Y" ? v.nickname : null,
      nicknameUsage: v.nicknameUsage,
      loginId: v.loginId,
      email: joinEmail(v.emailLocal, v.emailDomain, v.emailCustom),
      password: v.password,
      phone: `${v.phonePrefix}${v.phoneMid}${v.phoneLast}`,
      tel: v.tel,
      address: joinAddress(v.address, v.addressDetail),
      contactMethod: v.contactMethod,
      agreeTerms: v.agreeTerms,
      agreePrivacy: v.agreePrivacy,
    });
    if (res.ok) {
      showSuccess();
      return;
    }
    const mapped = res.fields
      ? { ...res, fields: Object.fromEntries(Object.entries(res.fields).map(([k, m]) => [serverFieldMap[k] ?? k, m])) }
      : res;
    // 칸에 붙는 오류는 칸 옆에 그대로 두고, 팝업은 무엇이 틀렸는지 한 줄로 알린다
    const message = applyServerError(mapped, setError, fields, t.form.errors) ?? t.result.checkFields;
    showFailure(message, res.code === UNREACHABLE);
    // 서버가 아이디·닉네임을 거부하면 그 칸에 오류를 붙이고(중복확인 버튼이 다시 열림) 확인 결과를 무효로
    for (const [code, name] of [["DUPLICATE_LOGIN_ID", "loginId"], ["DUPLICATE_NICKNAME", "nickname"]] as const) {
      if (res.code === code) setError(name, { type: "server", message: t.form.errors[code] });
      if (res.code === code || res.fields?.[name]) setChecked((c) => ({ ...c, [name]: false }));
    }
  });

  const canSubmit = verified && isValid && checked.loginId && (nicknameUsage === "N" || checked.nickname);
  const hint = !verified ? t.form.needVerify : !(agreeTerms && agreePrivacy) ? t.terms.needAgree : isValid && !canSubmit ? t.form.needCheck : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FieldShell label={t.verify.label} inline="narrow" note={!verified && <span className="text-ink-3">{t.verify.note}</span>}>
          {verified ? (
            <p role="status" className="h-11 flex items-center gap-1.5 rounded-md bg-green-soft px-3 text-[14px] font-bold text-green">
              <ShieldCheck size={18} /> {t.verify.done}
            </p>
          ) : (
            <IdentityVerifyButton onVerified={() => setVerified(true)} />
          )}
        </FieldShell>

        {/* 본인인증 전에는 입력을 막는다 (본인인증이 첫 단계) */}
        <fieldset disabled={!verified} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">
          <FormField<PersonalSignupInput> inline="narrow" name="name" label={t.form.name} placeholder={t.form.namePlaceholder} autoComplete="name" maxLength={30} />
          <CheckableField
            inline="narrow"
            name="loginId"
            label={t.form.loginId}
            hint={t.form.loginIdHint}
            placeholder={t.form.loginIdPlaceholder}
            autoComplete="username"
            autoCapitalize="none"
            maxLength={20}
            onStatus={onCheckStatus}
          />
          <EmailField inline="narrow" />
          <FormField<PersonalSignupInput>
            inline="narrow"
            name="password"
            label={t.form.password}
            type="password"
            placeholder={t.form.passwordPlaceholder}
            autoComplete="new-password"
            maxLength={32}
          />
          <FormField<PersonalSignupInput> inline="narrow" name="passwordConfirm" label={t.form.passwordConfirm} type="password" autoComplete="new-password" maxLength={32} />
          <PhoneField inline="narrow" />
          <FormField<PersonalSignupInput> inline="narrow" name="tel" label={t.form.tel} placeholder={t.form.telPlaceholder} autoComplete="tel" maxLength={20} />

          <FieldShell label={t.form.nickname} inline="narrow">
            <Label className="min-h-11 gap-2 text-[14px] font-normal cursor-pointer">
              <Checkbox
                id="nicknameUsage"
                checked={nicknameUsage === "Y"}
                onCheckedChange={(on) => {
                  const use = on === true;
                  form.setValue("nicknameUsage", use ? "Y" : "N", { shouldValidate: true, shouldDirty: true });
                  // 안 쓰면 확인할 것이 없다. 다시 쓰면 다시 확인
                  setChecked((current) => ({ ...current, nickname: !use }));
                }}
              />
              {t.form.nicknameUse}
              <span className="text-xs text-ink-3">{t.form.nicknameUseHint}</span>
            </Label>
          </FieldShell>
          {nicknameUsage === "Y" && (
            <CheckableField inline="narrow" name="nickname" label={t.form.nickname} hint={t.form.nicknameHint} placeholder={t.form.nicknamePlaceholder} maxLength={20} onStatus={onCheckStatus} />
          )}

          <AddressField inline="narrow" label={t.form.address} placeholder={t.form.addressPlaceholder} />
          <FieldShell label={t.form.contactMethod} inline="narrow">
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
          </FieldShell>

          <TermsAgreement kind="personal" />
        </fieldset>

        {hint && <p className="text-xs text-ink-3 text-center">{hint}</p>}
        <SubmitButton label={t.form.submit} disabled={!canSubmit} submitting={isSubmitting} />
      </form>

      <ResultDialog {...dialogProps(() => void onSubmit())} />
    </FormProvider>
  );
}
