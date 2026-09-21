"use client";

import { useRouter } from "next/navigation";
import { IdentityVerifyButton } from "@/components/auth/IdentityVerifyButton";
import { personalSignupFlow, personalSignupPath } from "@/lib/signupFlow";
import { signup as t } from "@/messages/signup";

export function VerifyStep() {
  const router = useRouter();

  function onVerified(verificationToken: string) {
    // 새로 시작하는 가입이므로 이전 진행 상태는 버림
    personalSignupFlow.clear();
    personalSignupFlow.update({ verificationToken });
    router.push(personalSignupPath.terms);
  }

  return (
    <div className="flex flex-col gap-4">
      <IdentityVerifyButton onVerified={onVerified} />
      <p className="text-center text-xs text-ink-3">{t.verify.note}</p>
    </div>
  );
}
