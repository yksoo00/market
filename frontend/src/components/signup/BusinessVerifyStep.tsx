"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormError } from "@/components/auth/FormStatus";
import { StepGuard } from "@/components/signup/StepGuard";
import { businessSignupFlow, businessSignupPath, parseState, type BusinessSignupState } from "@/lib/signupFlow";
import { businessVerifySchema, type BusinessVerifyInput } from "@/lib/validation/business";
import { signup as t } from "@/messages/signup";

const m = t.business.verify;
const noop = () => () => {};

/**
 * 사업자 인증. 국세청 진위확인 API 필수값(사업자번호·개업일·대표자)을 먼저 받는다.
 * TODO(백엔드 인증 구현 시): 지금은 UI 스텁 — 형식만 맞으면 통과. authApi.verifyBusiness 호출로 교체하고
 * BIZ_NOT_FOUND / BIZ_CLOSED / DUPLICATE_BIZ_NO 는 m.errors 로 표시.
 */
export function BusinessVerifyStep() {
  const router = useRouter();
  const form = useForm<BusinessVerifyInput>({
    resolver: zodResolver(businessVerifySchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { bizNo: "", startDate: "", ownerName: "" },
  });
  const {
    handleSubmit,
    formState: { isValid },
  } = form;
  // 정보입력에서 인증 만료로 돌아온 경우 안내
  const raw = useSyncExternalStore(noop, businessSignupFlow.raw, () => null);
  const notice = useMemo(() => parseState<BusinessSignupState>(raw).notice, [raw]);

  const onSubmit = handleSubmit((v) => {
    businessSignupFlow.update({
      notice: undefined,
      business: { bizNo: v.bizNo, startDate: v.startDate, ownerName: v.ownerName, verificationToken: "stub-business-token" },
    });
    router.push(businessSignupPath.form);
  });

  return (
    <StepGuard kind="business" require={["termsAgreed"]}>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={notice ? t.business.form.errors[notice] : null} />
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
          <Button type="submit" disabled={!isValid} className="h-11 w-full text-[15px] font-bold">
            <ShieldCheck /> {m.button}
          </Button>
          <p className="text-center text-xs text-ink-3">{m.note}</p>
        </form>
      </FormProvider>
    </StepGuard>
  );
}
