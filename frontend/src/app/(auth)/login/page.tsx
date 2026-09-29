import type { Metadata } from "next";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";
import { safeNext } from "@/lib/safeNext";
import { auth as t } from "@/messages/auth";

export const metadata: Metadata = { title: `${t.login.title} · 커널마켓` };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const initial = sp.type === "business" ? "business" : "personal";

  return (
    <RedirectIfAuthenticated destination={next}>
      <LoginPanel next={next} initial={initial} />
    </RedirectIfAuthenticated>
  );
}
