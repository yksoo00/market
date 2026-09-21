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

  return (
    <AuthCard title={t.login.title}>
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
