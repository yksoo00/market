"use client";

import { StepGuard } from "@/components/signup/StepGuard";
import { TermsForm } from "@/components/signup/TermsForm";
import { personalSignupFlow, personalSignupPath } from "@/lib/signupFlow";
import { personalTerms } from "@/messages/terms";

export function PersonalTermsStep() {
  return (
    <StepGuard require={["verificationToken"]}>
      <TermsForm
        items={personalTerms}
        onAgree={(optional) => {
          personalSignupFlow.update({ termsAgreed: true, marketingOptIn: Boolean(optional.marketing) });
          return personalSignupPath.form;
        }}
      />
    </StepGuard>
  );
}
