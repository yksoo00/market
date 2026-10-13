import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { PersonalSignupForm } from "@/components/signup/PersonalSignupForm";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.form.title} · 커널마켓` };

// 카드는 넓게(560): 라벨을 입력 왼쪽에 두는 격자(FormField inline="narrow")가 들어갈 폭
export default function SignupFormPage() {
  return (
    <AuthCard title={t.form.title} subtitle={t.form.subtitle} wide>
      <PersonalSignupForm />
    </AuthCard>
  );
}
