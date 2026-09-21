import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { SocialSignupForm } from "@/components/signup/SocialSignupForm";
import type { SocialProvider } from "@/lib/api/auth";
import { safeNext } from "@/lib/safeNext";
import { signup as t } from "@/messages/signup";

export const metadata: Metadata = { title: `${t.social.title} · 커널마켓` };

const m = t.social;
const providers: readonly string[] = ["kakao", "naver", "google"] satisfies SocialProvider[];

// OAuth 콜백(백엔드)이 신규 사용자를 여기로 보냄: ?provider=kakao&token=…&nickname=…&next=…
// token 은 짧은 수명의 임시 토큰. 검증은 제출 시 서버가.
export default async function SocialSignupPage({ searchParams }: PageProps<"/signup/social">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  // 쿼리값을 그대로 키로 쓰면 "constructor" 같은 프로토타입 키에 걸림 → 허용 목록으로
  const provider = typeof sp.provider === "string" && providers.includes(sp.provider) ? sp.provider : "";
  const nickname = typeof sp.nickname === "string" ? sp.nickname : "";

  if (!token) {
    return (
      <AuthCard title={m.title}>
        <p role="alert" className="py-2 text-center text-[14px] leading-relaxed text-down">
          {m.invalid}
        </p>
        <Link href="/login" className="mt-5 h-11 flex items-center justify-center rounded-md bg-primary text-white text-[15px] font-bold hover:bg-primary-dark">
          {m.toLogin}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={m.title} subtitle={`${m.subtitle[provider] ?? m.subtitleFallback} ${m.lead}`}>
      <SocialSignupForm token={token} suggestedNickname={nickname} next={safeNext(sp.next)} />
    </AuthCard>
  );
}
