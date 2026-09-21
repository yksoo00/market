import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { PersonalTermsStep } from "@/components/signup/PersonalTermsStep";
import { SignupSteps } from "@/components/signup/SignupSteps";
import { personalSteps } from "@/components/signup/steps";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.terms.title} · ${t.title} · 커널마켓` };

export default function SignupTermsPage() {
  return (
    <div className="w-full max-w-[420px] flex flex-col gap-4">
      <SignupSteps steps={personalSteps} current={1} />
      <AuthCard title={t.terms.title} subtitle={t.terms.subtitle}>
        <PersonalTermsStep />
      </AuthCard>
    </div>
  );
}
