"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormError } from "@/components/auth/FormStatus";
import { StepGuard } from "@/components/signup/StepGuard";
import { authApi } from "@/lib/api/auth";
import { businessSignupFlow, businessSignupPath, parseState, type BusinessSignupState } from "@/lib/signupFlow";
import { businessVerifySchema, type BusinessVerifyInput } from "@/lib/validation/business";
import { signup as t } from "@/messages/signup";

const m = t.business.verify;
const noop = () => () => {};

/**
 * 사업자 인증. 국세청 진위확인 API 필수값(사업자번호·개업일·대표자)을 먼저 받는다.
 * 국세청 연동 전까지 백엔드는 로컬 환경에서만 임시 토큰을 발급한다.
 */
export function BusinessVerifyStep() {
  const router = useRouter();
  const form = useForm<BusinessVerifyInput>({
    resolver: zodResolver(businessVerifySchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { bizNo: "", startDate: "", ownerName: "" },
  });
  const {
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  // 정보입력에서 인증 만료로 돌아온 경우 안내
  const raw = useSyncExternalStore(noop, businessSignupFlow.raw, () => null);
  const notice = useMemo(() => parseState<BusinessSignupState>(raw).notice, [raw]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const result = await authApi.verifyBusiness(v);
    if (!result.ok) {
      setFormError(result.code === "DUPLICATE_BIZ_NO" ? m.errors.DUPLICATE_BIZ_NO : result.message);
      return;
    }
    businessSignupFlow.update({
      notice: undefined,
      business: { bizNo: v.bizNo, startDate: v.startDate, ownerName: v.ownerName, verificationToken: result.data.verificationToken },
    });
    router.push(businessSignupPath.form);
  });

  return (
    <StepGuard kind="business" require={[]}>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={notice ? t.business.form.errors[notice] : formError} />
          <FormField<BusinessVerifyInput>
            name="bizNo"
            label={m.bizNo}
            placeholder={m.bizNoPlaceholder}
            inputMode="numeric"
            maxLength={12}
            className="num"
          />
          <FormField<BusinessVerifyInput>
            name="startDate"
            label={m.startDate}
            placeholder={m.startDatePlaceholder}
            inputMode="numeric"
            maxLength={8}
            className="num"
          />
          <FormField<BusinessVerifyInput> name="ownerName" label={m.ownerName} placeholder={m.ownerNamePlaceholder} maxLength={50} />
          <Button type="submit" disabled={!isValid || isSubmitting} className="h-11 w-full text-[15px] font-bold">
            <ShieldCheck /> {m.button}
          </Button>
          <p className="text-center text-xs text-ink-3">{m.note}</p>
        </form>
      </FormProvider>
    </StepGuard>
  );
}
