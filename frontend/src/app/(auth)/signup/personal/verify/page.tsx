import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupSteps } from "@/components/signup/SignupSteps";
import { VerifyStep } from "@/components/signup/VerifyStep";
import { personalSteps } from "@/components/signup/steps";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.verify.title} · ${t.title} · 커널마켓` };

export default function SignupVerifyPage() {
  return (
    <div className="w-full max-w-[420px] flex flex-col gap-4">
      <SignupSteps steps={personalSteps} current={0} />
      <AuthCard title={t.verify.title} subtitle={t.verify.subtitle}>
        <VerifyStep />
      </AuthCard>
    </div>
  );
}
