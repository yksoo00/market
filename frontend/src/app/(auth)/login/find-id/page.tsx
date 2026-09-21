import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { FindIdForm } from "@/components/auth/FindIdForm";
import { auth as t } from "@/messages/auth";

export const metadata: Metadata = { title: `${t.findId.title} · 커널마켓` };

export default function FindIdPage() {
  return (
    <AuthCard title={t.findId.title} subtitle={t.findId.subtitle}>
      <FindIdForm />
      <Link href="/login" className="mt-5 block text-center text-[13px] text-ink-2 hover:text-primary">
        ‹ {t.findId.backToLogin}
      </Link>
    </AuthCard>
  );
}
