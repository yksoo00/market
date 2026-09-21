"use client";

import { useState } from "react";
import Link from "next/link";
import { FormError } from "@/components/auth/FormStatus";
import { IdentityVerifyButton } from "@/components/auth/IdentityVerifyButton";
import { authApi } from "@/lib/api/auth";
import { auth as t } from "@/messages/auth";
import { UNREACHABLE } from "@/types/api";

interface Result {
  loginIdMasked: string;
  joinedAt: string;
}

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" });

// 본인인증 → 그 결과 토큰으로 아이디 조회. 입력 칸 없음
export function FindIdForm() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  async function lookup(verificationToken: string) {
    setToken(verificationToken);
    setLoading(true);
    setError(null);
    setUnreachable(false);
    const res = await authApi.findId({ verificationToken });
    setLoading(false);
    if (res.ok) {
      setResult(res.data);
      return;
    }
    setUnreachable(res.code === UNREACHABLE);
    setError(res.code === "NOT_FOUND" ? t.findId.notFound : res.message);
  }

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <dl className="rounded-md bg-bg px-4 py-3.5 flex flex-col gap-1.5">
          <dt className="text-xs text-ink-2">{t.findId.resultLabel}</dt>
          <dd className="num text-lg font-semibold">{result.loginIdMasked}</dd>
          <dd className="text-xs text-ink-3">
            {t.findId.joinedAt} {dateFmt.format(new Date(result.joinedAt))}
          </dd>
        </dl>
        <Link href="/login" className="h-11 flex items-center justify-center rounded-md bg-primary text-white text-[15px] font-bold hover:bg-primary-dark">
          {t.findId.toLogin}
        </Link>
        <Link href="/login/find-password" className="text-center text-[13px] text-ink-2 hover:text-primary">
          {t.findId.toFindPassword}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} onRetry={unreachable && token ? () => void lookup(token) : undefined} />
      <IdentityVerifyButton onVerified={lookup} disabled={loading} />
      <p className="text-center text-xs text-ink-3">{t.findId.businessNote}</p>
    </div>
  );
}
