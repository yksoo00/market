"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldShell, FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/FormStatus";
import { ResultDialog } from "@/components/common/ResultDialog";
import { AddressField } from "@/components/signup/AddressField";
import { CheckableField } from "@/components/signup/CheckableField";
import { EmailField } from "@/components/signup/EmailField";
import { PhoneField } from "@/components/signup/PhoneField";
import { TermsAgreement } from "@/components/signup/TermsAgreement";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { joinAddress } from "@/lib/postcode";
import { bizNoSchema } from "@/lib/validation/auth";
import { businessSignupSchema, type BusinessSignupInput } from "@/lib/validation/business";
import { joinEmail } from "@/lib/validation/signup";
import { common as tc } from "@/messages/common";
import { signup as t } from "@/messages/signup";
import { UNREACHABLE } from "@/types/api";

const m = t.business.form;

const fields = [
  "contactName", "phoneMid", "phoneLast", "emailLocal", "emailCustom", "contactTel", "loginId", "password", "passwordConfirm",
  "bizNo", "bizType", "companyName", "companyTel", "address", "addressDetail", "agreeTerms", "agreePrivacy",
] as const;
const serverFieldMap: Record<string, (typeof fields)[number]> = {
  contactEmail: "emailLocal",
  contactPhone: "phoneMid",
  verificationToken: "bizNo",
};

type Result = { tone: "success" } | { tone: "error"; message: string; retry: boolean } | null;

// 한 페이지 기업 가입 (사용자 지시, 2026-10-13): 담당자 → 계정(아이디·비밀번호) → 사업자번호 [조회] + 회사 정보 → 약관.
// 사업자번호 조회 결과(토큰)는 폼 값이 아니라 이 컴포넌트 상태 — 번호를 고치면 다시 조회해야 한다
export function BusinessSignupForm() {
  const router = useRouter();
  const form = useForm<BusinessSignupInput>({
    resolver: zodResolver(businessSignupSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      contactName: "",
      phonePrefix: "010",
      phoneMid: "",
      phoneLast: "",
      emailLocal: "",
      emailDomain: "naver.com",
      emailCustom: "",
      contactTel: "",
      loginId: "",
      password: "",
      passwordConfirm: "",
      bizNo: "",
      bizType: "corporation",
      companyName: "",
      companyTel: "",
      address: "",
      addressDetail: "",
      agreeTerms: false,
      agreePrivacy: false,
    },
  });
  const {
    handleSubmit,
    setError,
    clearErrors,
    control,
    formState: { isValid, isSubmitting },
  } = form;
  const [bizNo, agreeTerms, agreePrivacy] = useWatch({ control, name: ["bizNo", "agreeTerms", "agreePrivacy"] });
  const [token, setToken] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [loginIdChecked, setLoginIdChecked] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const onCheckStatus = useCallback((_: "loginId" | "nickname", available: boolean) => setLoginIdChecked(available), []);

  async function lookup() {
    const parsed = bizNoSchema.safeParse(bizNo);
    if (!parsed.success) return;
    setLookingUp(true);
    const res = await authApi.verifyBusiness({ bizNo: parsed.data });
    setLookingUp(false);
    if (form.getValues("bizNo") !== bizNo) return; // 응답 오는 사이 번호를 고쳤다
    if (res.ok) {
      setToken(res.data.verificationToken);
      clearErrors("bizNo");
    } else {
      setError("bizNo", { type: "server", message: m.errors[res.code] ?? res.message });
    }
  }

  const onSubmit = handleSubmit(async (v) => {
    if (!token) return;
    const res = await authApi.signupBusiness({
      verificationToken: token,
      loginId: v.loginId,
      password: v.password,
      bizType: v.bizType,
      companyName: v.companyName,
      address: joinAddress(v.address, v.addressDetail),
      contactName: v.contactName,
      contactPhone: `${v.phonePrefix}${v.phoneMid}${v.phoneLast}`,
      contactEmail: joinEmail(v.emailLocal, v.emailDomain, v.emailCustom),
      contactTel: v.contactTel,
      companyTel: v.companyTel,
      agreeTerms: v.agreeTerms,
      agreePrivacy: v.agreePrivacy,
    });
    if (res.ok) {
      setResult({ tone: "success" });
      return;
    }
    const mapped = res.fields
      ? { ...res, fields: Object.fromEntries(Object.entries(res.fields).map(([k, msg]) => [serverFieldMap[k] ?? k, msg])) }
      : res;
    const message = applyServerError(mapped, setError, fields, m.errors) ?? t.result.checkFields;
    setResult({ tone: "error", message, retry: res.code === UNREACHABLE });
    // 조회가 만료됐거나 그 사이 누가 같은 번호로 가입했으면 번호 칸에서 다시 조회하게
    if (res.code === "VERIFICATION_EXPIRED" || res.code === "DUPLICATE_BIZ_NO") {
      setToken(null);
      setError("bizNo", { type: "server", message: m.errors[res.code] });
    }
    if (res.code === "DUPLICATE_LOGIN_ID") {
      setError("loginId", { type: "server", message: m.errors.DUPLICATE_LOGIN_ID });
      setLoginIdChecked(false);
    }
  });

  const canSubmit = isValid && Boolean(token) && loginIdChecked;
  const hint = !(agreeTerms && agreePrivacy)
    ? t.terms.needAgree
    : isValid && !token
      ? m.needLookup
      : isValid && !loginIdChecked
        ? t.form.needCheck
        : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Section title={m.contactSection} first>
          <FormField<BusinessSignupInput> inline="narrow" name="contactName" label={m.contactName} placeholder={t.form.namePlaceholder} autoComplete="name" maxLength={30} />
          <PhoneField inline="narrow" label={m.contactPhone} />
          <EmailField inline="narrow" label={m.contactEmail} />
          <FormField<BusinessSignupInput> inline="narrow" name="contactTel" label={m.contactTel} placeholder={m.contactTelPlaceholder} autoComplete="tel" maxLength={20} />
        </Section>

        <Section title={m.accountSection}>
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
          <FormField<BusinessSignupInput>
            inline="narrow"
            name="password"
            label={m.password}
            type="password"
            placeholder={t.form.passwordPlaceholder}
            autoComplete="new-password"
            maxLength={32}
          />
          <FormField<BusinessSignupInput> inline="narrow" name="passwordConfirm" label={m.passwordConfirm} type="password" autoComplete="new-password" maxLength={32} />
        </Section>

        <Section title={m.companySection}>
          <FormField<BusinessSignupInput>
            inline="narrow"
            name="bizNo"
            label={m.bizNo}
            placeholder={m.bizNoPlaceholder}
            inputMode="numeric"
            maxLength={12}
            // 번호를 고치면 조회 결과는 무효
            onChange={() => token && setToken(null)}
            note={token ? <span className="text-up">{m.lookupDone}</span> : <span className="text-ink-3">{m.lookupNote}</span>}
            trailing={
              <Button
                type="button"
                variant="outline"
                onClick={() => void lookup()}
                disabled={!bizNoSchema.safeParse(bizNo).success || lookingUp || Boolean(token)}
                className="h-11 shrink-0 px-3.5 text-[13px] font-semibold border-primary text-primary hover:bg-primary-soft hover:text-primary-dark"
              >
                {lookingUp ? tc.submitting : m.lookup}
              </Button>
            }
          />
          <FieldShell label={m.bizType} htmlFor="bizType" inline="narrow">
            <Controller
              control={control}
              name="bizType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="bizType" className="h-11 w-full bg-surface text-[15px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(m.bizTypes) as (keyof typeof m.bizTypes)[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {m.bizTypes[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FieldShell>
          <FormField<BusinessSignupInput> inline="narrow" name="companyName" label={m.companyName} placeholder={m.companyNamePlaceholder} autoComplete="organization" maxLength={50} />
          <FormField<BusinessSignupInput> inline="narrow" name="companyTel" label={m.companyTel} placeholder={m.companyTelPlaceholder} autoComplete="tel" maxLength={20} />
          <AddressField inline="narrow" label={m.address} placeholder={m.addressPlaceholder} />
        </Section>

        <TermsAgreement kind="business" />

        <p className="rounded-md bg-bg px-3.5 py-3 text-xs leading-relaxed text-ink-2">{m.reviewNotice}</p>
        {hint && <p className="text-xs text-ink-3 text-center">{hint}</p>}
        <SubmitButton label={m.submit} disabled={!canSubmit} submitting={isSubmitting} />
      </form>

      <ResultDialog
        open={result !== null}
        tone={result?.tone ?? "success"}
        title={result?.tone === "error" ? t.result.failTitle : t.result.businessTitle}
        message={result?.tone === "error" ? result.message : t.result.businessMessage}
        actionLabel={result?.tone === "error" ? t.result.ok : t.result.toLogin}
        // 가입이 끝나면 이 칸을 기업 탭 로그인으로 (타일 칸이면 큐가 로그인 칸으로 정리)
        onAction={() => (result?.tone === "success" ? router.replace("/login?type=business") : setResult(null))}
        onClose={result?.tone === "error" ? () => setResult(null) : undefined}
        retryLabel={tc.retry}
        onRetry={result?.tone === "error" && result.retry ? () => { setResult(null); void onSubmit(); } : undefined}
      />
    </FormProvider>
  );
}

function Section({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-4 ${first ? "" : "pt-4 border-t border-line-2"}`}>
      <h2 className="text-[14px] font-bold">{title}</h2>
      {children}
    </section>
  );
}
