import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { personalSignupPath } from "@/lib/signupFlow";

export const metadata: Metadata = { title: "회원가입 · 커널마켓" };

export default function SignupVerifyPage() {
  redirect(personalSignupPath.form);
}
