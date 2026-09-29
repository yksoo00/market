import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { BusinessFormStep } from "@/components/signup/BusinessFormStep";
import { SignupSteps } from "@/components/signup/SignupSteps";
import { businessSteps } from "@/components/signup/steps";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.business.form.title} · ${t.title} · 커널마켓` };

export default function BusinessFormPage() {
  return (
    <div className="w-full max-w-[560px] flex flex-col gap-4">
      <SignupSteps steps={businessSteps} current={1} />
      <AuthCard title={t.business.form.title} subtitle={t.business.form.subtitle} wide>
        <BusinessFormStep />
      </AuthCard>
    </div>
  );
}
