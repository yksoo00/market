"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldShell, FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { EmailField } from "@/components/signup/EmailField";
import { PhoneField } from "@/components/signup/PhoneField";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { businessSignupFlow, businessSignupPath, type BusinessSignupState } from "@/lib/signupFlow";
import { businessSignupSchema, type BusinessSignupInput } from "@/lib/validation/business";
import { joinEmail } from "@/lib/validation/signup";
import { signup as t } from "@/messages/signup";
import { UNREACHABLE } from "@/types/api";

const m = t.business.form;

const fields = [
  "password", "passwordConfirm", "bizType", "companyName", "address",
  "contactName", "phoneMid", "phoneLast", "emailLocal", "emailCustom", "contactTel", "companyTel",
] as const;
const serverFieldMap: Record<string, (typeof fields)[number]> = {
  contactEmail: "emailLocal",
  contactPhone: "phoneMid",
};

export function BusinessSignupForm({ business }: { business: NonNullable<BusinessSignupState["business"]> }) {
  const router = useRouter();
  const form = useForm<BusinessSignupInput>({
    resolver: zodResolver(businessSignupSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      bizNo: business.bizNo,
      password: "",
      passwordConfirm: "",
      bizType: "corporation",
      companyName: "",
      address: "",
      contactName: "",
      phonePrefix: "010",
      phoneMid: "",
      phoneLast: "",
      contactTel: "",
      companyTel: "",
      emailLocal: "",
      emailDomain: "naver.com",
      emailCustom: "",
    },
  });
  const {
    handleSubmit,
    setError,
    control,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setUnreachable(false);

    const result = await authApi.signupBusiness({
      verificationToken: business.verificationToken,
      password: v.password,
      bizType: v.bizType,
      companyName: v.companyName,
      address: v.address,
      contactName: v.contactName,
      contactPhone: `${v.phonePrefix}${v.phoneMid}${v.phoneLast}`,
      contactEmail: joinEmail(v.emailLocal, v.emailDomain, v.emailCustom),
      contactTel: v.contactTel,
      companyTel: v.companyTel,
    });
    if (result.ok) {
      businessSignupFlow.clear();
      router.push(businessSignupPath.done);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    const mapped = result.fields
      ? { ...result, fields: Object.fromEntries(Object.entries(result.fields).map(([k, msg]) => [serverFieldMap[k] ?? k, msg])) }
      : result;
    setFormError(applyServerError(mapped, setError, fields, m.errors));
    if (result.code === "VERIFICATION_EXPIRED") {
      // 인증 페이지가 안내를 보여주도록 표시를 남기고 돌려보낸다
      businessSignupFlow.update({ business: undefined, notice: "VERIFICATION_EXPIRED" });
      router.replace(businessSignupPath.verify);
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} onRetry={unreachable ? () => void onSubmit() : undefined} />

        <VerifiedBusiness business={business} />

        <FormField<BusinessSignupInput>
          name="password"
          label={m.password}
          type="password"
          placeholder={t.form.passwordPlaceholder}
          autoComplete="new-password"
          maxLength={32}
        />
        <FormField<BusinessSignupInput> name="passwordConfirm" label={m.passwordConfirm} type="password" autoComplete="new-password" maxLength={32} />

        <FieldShell label={m.bizType} htmlFor="bizType">
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

        <FormField<BusinessSignupInput> name="companyName" label={m.companyName} placeholder={m.companyNamePlaceholder} autoComplete="organization" maxLength={50} />
        <FormField<BusinessSignupInput> name="companyTel" label={m.companyTel} placeholder={m.companyTelPlaceholder} autoComplete="tel" maxLength={20} />
        {/* TODO(주소 검색): 우편번호 API 붙이기 전까지 직접 입력 */}
        <FormField<BusinessSignupInput> name="address" label={m.address} placeholder={m.addressPlaceholder} autoComplete="street-address" maxLength={200} />
        <h2 className="mt-2 pt-4 border-t border-line-2 text-[14px] font-bold">{m.contactSection}</h2>
        <FormField<BusinessSignupInput> name="contactName" label={m.contactName} placeholder={t.form.namePlaceholder} autoComplete="name" maxLength={30} />
        <PhoneField label={m.contactPhone} />
        <FormField<BusinessSignupInput> name="contactTel" label={m.contactTel} placeholder={m.contactTelPlaceholder} autoComplete="tel" maxLength={20} />
        <EmailField label={m.contactEmail} />

        <p className="rounded-md bg-bg px-3.5 py-3 text-xs leading-relaxed text-ink-2">{m.reviewNotice}</p>
        <SubmitButton label={m.submit} disabled={!isValid} submitting={isSubmitting} />
      </form>
    </FormProvider>
  );
}

function VerifiedBusiness({ business }: { business: NonNullable<BusinessSignupState["business"]> }) {
  const bizNo = `${business.bizNo.slice(0, 3)}-${business.bizNo.slice(3, 5)}-${business.bizNo.slice(5)}`;
  const date = `${business.startDate.slice(0, 4)}.${business.startDate.slice(4, 6)}.${business.startDate.slice(6)}`;
  return (
    <dl className="rounded-md bg-green-soft px-4 py-3 flex flex-col gap-1 text-[13px]">
      <dt className="flex items-center gap-1.5 font-bold text-green">
        <ShieldCheck size={16} /> {m.verified}
      </dt>
      <dd className="flex gap-3 text-ink">
        <span className="num">{bizNo}</span>
        <span className="num text-ink-2">{date}</span>
        <span>{business.ownerName}</span>
      </dd>
    </dl>
  );
}
