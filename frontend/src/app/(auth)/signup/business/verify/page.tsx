import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { BusinessVerifyStep } from "@/components/signup/BusinessVerifyStep";
import { SignupSteps } from "@/components/signup/SignupSteps";
import { businessSteps } from "@/components/signup/steps";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.business.verify.title} · ${t.title} · 커널마켓` };

export default function BusinessVerifyPage() {
  return (
    <div className="w-full max-w-[420px] flex flex-col gap-4">
      <SignupSteps steps={businessSteps} current={1} />
      <AuthCard title={t.business.verify.title} subtitle={t.business.verify.subtitle}>
        <BusinessVerifyStep />
      </AuthCard>
    </div>
  );
}
