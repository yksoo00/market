import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { auth as t } from "@/messages/auth";

export const metadata: Metadata = { title: `${t.resetPassword.title} · 커널마켓` };

// 기업 비밀번호 찾기 이메일의 링크가 여기로 옴. 토큰 검증은 제출 시 서버가.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/login/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  if (!token) {
    return (
      <AuthCard title={t.resetPassword.title}>
        <p role="alert" className="py-2 text-center text-[14px] leading-relaxed text-down">
          {t.resetPassword.invalid}
        </p>
        <Link
          href="/login/find-password?type=business"
          className="mt-5 h-11 flex items-center justify-center rounded-md bg-primary text-white text-[15px] font-bold hover:bg-primary-dark"
        >
          {t.resetPassword.toFindPassword}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t.resetPassword.title} subtitle={t.resetPassword.subtitle}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
