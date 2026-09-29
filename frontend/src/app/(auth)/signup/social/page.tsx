import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { auth as t } from "@/messages/auth";

export const metadata: Metadata = { title: `${t.login.title} · 커널마켓` };

export default function SocialSignupDisabledPage() {
  return (
    <AuthCard title={t.login.title}>
      <p role="status" className="py-2 text-center text-[14px] leading-relaxed text-ink-2">
        소셜 로그인은 현재 사용할 수 없습니다. 아이디와 비밀번호로 로그인해 주세요.
      </p>
    </AuthCard>
  );
}
