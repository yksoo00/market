import type { Metadata } from "next";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthCard } from "@/components/auth/AuthCard";
import { BusinessFindPasswordForm } from "@/components/auth/BusinessFindPasswordForm";
import { FindPasswordForm } from "@/components/auth/FindPasswordForm";
import { auth as t } from "@/messages/auth";

export const metadata: Metadata = { title: `${t.findPassword.title} · 커널마켓` };

const tabClass = "h-10 text-[14px] data-active:font-bold";

export default async function FindPasswordPage({ searchParams }: PageProps<"/login/find-password">) {
  const sp = await searchParams;
  const initial = sp.type === "business" ? "business" : "personal";

  return (
    <AuthCard title={t.findPassword.title}>
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
          <p className="text-[13px] text-ink-2">{t.findPassword.subtitle.personal}</p>
          <FindPasswordForm />
        </TabsContent>
        <TabsContent value="business" className="flex flex-col gap-5">
          <p className="text-[13px] text-ink-2">{t.findPassword.subtitle.business}</p>
          <BusinessFindPasswordForm />
        </TabsContent>
      </Tabs>
      <Link href="/login" className="mt-5 block text-center text-[13px] text-ink-2 hover:text-primary">
        ‹ {t.findPassword.backToLogin}
      </Link>
    </AuthCard>
  );
}
