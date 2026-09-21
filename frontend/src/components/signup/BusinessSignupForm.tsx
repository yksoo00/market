"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { cn } from "cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldShell, FormField, useFieldStatus } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { CaptchaPlaceholder } from "@/components/signup/CaptchaPlaceholder";
import { EmailField } from "@/components/signup/EmailField";
import { PhoneField } from "@/components/signup/PhoneField";
import { authApi } from "@/lib/api/auth";
import { applyServerError } from "@/lib/form";
import { businessSignupFlow, businessSignupPath, type BusinessSignupState } from "@/lib/signupFlow";
import { businessSignupSchema, LICENSE_TYPES, type BusinessSignupInput } from "@/lib/validation/business";
import { joinEmail } from "@/lib/validation/signup";
import { signup as t } from "@/messages/signup";
import { UNREACHABLE } from "@/types/api";

const m = t.business.form;

const fields = [
  "password", "passwordConfirm", "bizType", "companyName", "address", "license",
  "contactName", "phoneMid", "phoneLast", "emailLocal", "emailCustom", "captchaToken",
] as const;
const serverFieldMap: Record<string, (typeof fields)[number]> = {
  contactEmail: "emailLocal",
  contactPhone: "phoneMid",
  licenseFileKey: "license",
};

export function BusinessSignupForm({ business }: { business: NonNullable<BusinessSignupState["business"]> }) {
  const router = useRouter();
  const form = useForm<BusinessSignupInput>({
    resolver: zodResolver(businessSignupSchema),
    mode: "onBlur",
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
      emailLocal: "",
      emailDomain: "naver.com",
      emailCustom: "",
      captchaToken: "",
      marketingOptIn: businessSignupFlow.get().marketingOptIn ?? false,
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
  // 같은 파일이면 재시도 때 다시 올리지 않는다 (10MB 재전송·고아 파일·업로드 rate limit 방지)
  const [uploaded, setUploaded] = useState<{ file: File; key: string } | null>(null);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setUnreachable(false);

    // 파일 먼저 올리고 키를 받아 가입 요청에 넣는다
    const file = v.license[0];
    let licenseFileKey = uploaded?.file === file ? uploaded.key : null;
    if (!licenseFileKey) {
      const res = await authApi.uploadBusinessLicense(file);
      if (!res.ok) {
        setUnreachable(res.code === UNREACHABLE);
        setFormError(applyServerError(res, setError, ["license"]));
        return;
      }
      licenseFileKey = res.data.fileKey;
      setUploaded({ file, key: licenseFileKey });
    }

    const result = await authApi.signupBusiness({
      verificationToken: business.verificationToken,
      password: v.password,
      bizType: v.bizType,
      companyName: v.companyName,
      address: v.address,
      licenseFileKey,
      contactName: v.contactName,
      contactPhone: `${v.phonePrefix}${v.phoneMid}${v.phoneLast}`,
      contactEmail: joinEmail(v.emailLocal, v.emailDomain, v.emailCustom),
      captchaToken: v.captchaToken,
      marketingOptIn: v.marketingOptIn,
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
        {/* TODO(주소 검색): 우편번호 API 붙이기 전까지 직접 입력 */}
        <FormField<BusinessSignupInput> name="address" label={m.address} placeholder={m.addressPlaceholder} autoComplete="street-address" maxLength={200} />
        <LicenseField />

        <h2 className="mt-2 pt-4 border-t border-line-2 text-[14px] font-bold">{m.contactSection}</h2>
        <FormField<BusinessSignupInput> name="contactName" label={m.contactName} placeholder={t.form.namePlaceholder} autoComplete="name" maxLength={30} />
        <PhoneField label={m.contactPhone} />
        <EmailField label={m.contactEmail} />

        <CaptchaPlaceholder />

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

/** 사업자등록증 파일. 선택 즉시 형식·크기 검사 (rules/frontend.md) */
function LicenseField() {
  const { register, control } = useFormContext<BusinessSignupInput>();
  const { error, valid } = useFieldStatus<BusinessSignupInput>("license");
  const files = useWatch({ control, name: "license" }) as FileList | undefined;
  const fileName = files && files.length > 0 ? files[0].name : null;
  const reg = register("license");

  return (
    <FieldShell label={m.license} htmlFor="license" hint={m.licenseHint} error={error}>
      <label
        className={cn(
          // relative: 안의 sr-only input 이 이 박스 안에 머물러야 포커스 시 화면이 엉뚱한 곳으로 안 튐
          "relative flex items-center gap-3 h-11 px-3 rounded-md border bg-surface cursor-pointer text-[14px]",
          "focus-within:ring-3 focus-within:ring-ring/50",
          error ? "border-down" : valid ? "border-up" : "border-line",
        )}
      >
        <span className="shrink-0 px-2.5 h-7 flex items-center rounded-md bg-primary-soft text-primary-dark text-xs font-semibold">
          {m.licenseChoose}
        </span>
        <span className={cn("truncate", fileName ? "text-ink" : "text-ink-3")}>{fileName ?? m.licenseNone}</span>
        <input
          id="license"
          type="file"
          accept={LICENSE_TYPES.join(",")}
          className="sr-only"
          aria-invalid={Boolean(error)}
          {...reg}
          onChange={(e) => {
            void reg.onChange(e);
            // 파일 선택은 blur 가 안 오므로 blur 이벤트를 흉내 내서 touched + 검증을 바로 켠다
            void reg.onBlur({ target: e.target, type: "blur" });
          }}
        />
      </label>
    </FieldShell>
  );
}
