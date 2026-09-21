"use client";

import { useMemo, useSyncExternalStore } from "react";
import { BusinessSignupForm } from "@/components/signup/BusinessSignupForm";
import { StepGuard } from "@/components/signup/StepGuard";
import { businessSignupFlow, parseState, type BusinessSignupState } from "@/lib/signupFlow";

const noop = () => () => {};

/** 가드 통과 후 인증 결과를 읽어 폼에 넘긴다. 서버 스냅샷은 없음 (가드가 서버에선 안 그림) */
export function BusinessFormStep() {
  const raw = useSyncExternalStore(noop, businessSignupFlow.raw, () => null);
  const business = useMemo(() => parseState<BusinessSignupState>(raw).business, [raw]);
  return (
    <StepGuard kind="business" require={["termsAgreed", "business"]}>
      {business && <BusinessSignupForm business={business} />}
    </StepGuard>
  );
}
