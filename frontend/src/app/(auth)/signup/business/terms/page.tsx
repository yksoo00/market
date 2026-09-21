import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { BusinessTermsStep } from "@/components/signup/BusinessTermsStep";
import { SignupSteps } from "@/components/signup/SignupSteps";
import { businessSteps } from "@/components/signup/steps";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.terms.title} · ${t.title} · 커널마켓` };

export default function BusinessTermsPage() {
  return (
    <div className="w-full max-w-[420px] flex flex-col gap-4">
      <SignupSteps steps={businessSteps} current={0} />
      <AuthCard title={t.terms.title} subtitle={t.terms.subtitle}>
        <BusinessTermsStep />
      </AuthCard>
    </div>
  );
}
