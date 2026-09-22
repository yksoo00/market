import type { Metadata } from "next";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { safeNext } from "@/lib/safeNext";
import { auth as t } from "@/messages/auth";

export const metadata: Metadata = { title: `${t.login.title} · 커널마켓` };

const tabClass = "h-10 text-[14px] data-active:font-bold";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const initial = sp.type === "business" ? "business" : "personal";
  const withNext = (path: string) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`);
  const oauthError = oauthErrorMessage(sp.error, sp.method);

  return (
    <AuthCard title={t.login.title}>
      {oauthError && (
        <p role="alert" className="mb-5 rounded-md border border-down/30 bg-down/5 px-3 py-2.5 text-[13px] text-down">
          {oauthError}
        </p>
      )}
      <Tabs defaultValue={initial} className="gap-5">
        <TabsList variant="line" className="w-full h-10 border-b border-line p-0">
          <TabsTrigger value="personal" className={tabClass}>
            {t.tabs.personal}
          </TabsTrigger>
          <TabsTrigger value="business" className={tabClass}>
            {t.tabs.business}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="flex flex-col gap-5">
          <p className="text-[13px] text-ink-2">{t.login.subtitle.personal}</p>
          <LoginForm kind="personal" next={next} />
          <FindLinks />
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span className="grow border-t border-line-2" />
            {t.login.socialDivider}
            <span className="grow border-t border-line-2" />
          </div>
          <SocialButtons next={next} />
          <p className="text-center text-[13px] text-ink-2">
            {t.login.noAccount}{" "}
            <Link href={withNext("/signup")} className="font-semibold text-primary hover:underline">
              {t.login.signup}
            </Link>
          </p>
        </TabsContent>

        <TabsContent value="business" className="flex flex-col gap-5">
          <p className="text-[13px] text-ink-2">{t.login.subtitle.business}</p>
          <LoginForm kind="business" next={next} />
          <div className="flex items-center justify-center gap-2 text-[13px] text-ink-2">
            <Link href="/login/find-password?type=business" className="hover:text-primary">
              {t.login.findPassword}
            </Link>
          </div>
          <p className="text-center text-[13px] text-ink-2">
            {t.login.businessHint}{" "}
            <Link href={withNext("/signup?type=business")} className="font-semibold text-primary hover:underline">
              {t.login.signup}
            </Link>
          </p>
        </TabsContent>
      </Tabs>
    </AuthCard>
  );
}

/** 소셜 콜백의 ?error=&method= → 문구. 쿼리값을 그대로 키로 쓰지 않고 허용 목록으로만 (프로토타입 키 방지) */
function oauthErrorMessage(error: string | string[] | undefined, method: string | string[] | undefined): string | null {
  const code = typeof error === "string" && Object.hasOwn(t.login.oauthErrors, error) ? error : null;
  if (!code) return null;
  const m = typeof method === "string" && Object.hasOwn(t.login.methodLabel, method) ? t.login.methodLabel[method] : "다른 방식";
  return t.login.oauthErrors[code].replace("{method}", m);
}

function FindLinks() {
  return (
    <div className="flex items-center justify-center gap-2 text-[13px] text-ink-2">
      <Link href="/login/find-id" className="hover:text-primary">
        {t.login.findId}
      </Link>
      <span className="text-ink-3">·</span>
      <Link href="/login/find-password" className="hover:text-primary">
        {t.login.findPassword}
      </Link>
    </div>
  );
}
