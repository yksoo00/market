import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.done.title} · 커널마켓` };

export default function SignupDonePage() {
  return (
    <AuthCard title={t.done.title}>
      <div className="flex flex-col items-center gap-5 text-center">
        <CheckCircle2 size={48} className="text-up" aria-hidden="true" />
        <p className="text-[14px] leading-relaxed">{t.done.message}</p>
        <Link href="/login" className="h-11 w-full flex items-center justify-center rounded-md bg-primary text-white text-[15px] font-bold hover:bg-primary-dark">
          {t.done.login}
        </Link>
        <Link href="/" className="text-[13px] text-ink-2 hover:text-primary">
          {t.done.home}
        </Link>
      </div>
    </AuthCard>
  );
}
