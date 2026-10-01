import type { Metadata } from "next";
import { SignupChoosePanel } from "@/components/auth/SignupChoosePanel";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.title} · 커널마켓` };

export default function SignupChoosePage() {
  return <SignupChoosePanel />;
}
