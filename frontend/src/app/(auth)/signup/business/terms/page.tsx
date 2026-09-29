import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "기업 회원가입 · 커널마켓" };

export default function BusinessTermsPage() {
  redirect("/signup/business/verify");
}
