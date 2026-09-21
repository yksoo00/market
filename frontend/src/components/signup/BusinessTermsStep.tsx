"use client";

import { TermsForm } from "@/components/signup/TermsForm";
import { businessSignupFlow, businessSignupPath } from "@/lib/signupFlow";
import { businessTerms } from "@/messages/terms";

export function BusinessTermsStep() {
  return (
    <TermsForm
      items={businessTerms}
      onAgree={(optional) => {
        // 새로 시작하는 가입이므로 이전 진행 상태는 버림
        businessSignupFlow.clear();
        businessSignupFlow.update({ termsAgreed: true, marketingOptIn: Boolean(optional.marketing) });
        return businessSignupPath.verify;
      }}
    />
  );
}
