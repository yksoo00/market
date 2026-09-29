import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/common/Icon";
import { AuthCard } from "@/components/auth/AuthCard";
import { businessSignupPath, personalSignupPath } from "@/lib/signupFlow";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.title} · 커널마켓` };

export default function SignupChoosePage() {
  return (
    <AuthCard title={t.title} subtitle={t.choose.subtitle}>
      <div className="flex flex-col gap-3">
        <Choice href={personalSignupPath.form} icon="user" tone="primary" title={t.choose.personal.title} desc={t.choose.personal.desc} />
        <Choice href={businessSignupPath.verify} icon="business" tone="green" title={t.choose.business.title} desc={t.choose.business.desc} />
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-2">
        {t.choose.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t.choose.login}
        </Link>
      </p>
    </AuthCard>
  );
}

interface ChoiceProps {
  href: string;
  icon: "user" | "business";
  tone: "primary" | "green";
  title: string;
  desc: string;
}

function Choice({ href, icon, tone, title, desc }: ChoiceProps) {
  const circle = tone === "primary" ? "bg-primary-soft text-primary" : "bg-green-soft text-green";
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-[10px] border border-line bg-surface p-4 hover:border-primary hover:bg-bg transition-colors"
    >
      <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${circle}`}>
        <Icon name={icon} />
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] text-ink-2">{desc}</span>
      </span>
    </Link>
  );
}
