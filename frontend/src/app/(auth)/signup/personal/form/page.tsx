import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { PersonalSignupForm } from "@/components/signup/PersonalSignupForm";
import { SignupSteps } from "@/components/signup/SignupSteps";
import { StepGuard } from "@/components/signup/StepGuard";
import { personalSteps } from "@/components/signup/steps";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.form.title} · ${t.title} · 커널마켓` };

export default function SignupFormPage() {
  return (
    <div className="w-full max-w-[420px] flex flex-col gap-4">
      <SignupSteps steps={personalSteps} current={0} />
      <AuthCard title={t.form.title} subtitle={t.form.subtitle}>
        <StepGuard kind="personal" require={[]}>
          <PersonalSignupForm />
        </StepGuard>
      </AuthCard>
    </div>
  );
}
