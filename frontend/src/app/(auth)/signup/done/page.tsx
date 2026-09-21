import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.done.title} · 커널마켓` };

// 기업은 관리자 심사(decisions.md 2026-09-21)가 남아 있어 문구가 다름
export default async function SignupDonePage({ searchParams }: PageProps<"/signup/done">) {
  const sp = await searchParams;
  const isBusiness = sp.type === "business";
  return (
    <AuthCard title={isBusiness ? t.done.businessTitle : t.done.title}>
      <div className="flex flex-col items-center gap-5 text-center">
        {isBusiness ? (
          <Clock size={48} className="text-primary" aria-hidden="true" />
        ) : (
          <CheckCircle2 size={48} className="text-up" aria-hidden="true" />
        )}
        <p className="text-[14px] leading-relaxed">{isBusiness ? t.done.businessMessage : t.done.message}</p>
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
