import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { BusinessSignupForm } from "@/components/signup/BusinessSignupForm";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.business.form.title} · 커널마켓` };

export default function BusinessFormPage() {
  return (
    <AuthCard title={t.business.form.title} subtitle={t.business.form.subtitle} wide>
      <BusinessSignupForm />
    </AuthCard>
  );
}
