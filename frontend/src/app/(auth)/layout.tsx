import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { HomeAuthPane } from "@/components/auth/HomeAuthPane";
import { AUTH_HOME_CLOSED_COOKIE } from "@/lib/authSplit";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const homeClosed = (await cookies()).get(AUTH_HOME_CLOSED_COOKIE)?.value === "1";
  return (
    <AuthSplitShell home={<HomeAuthPane />} homeClosed={homeClosed}>
      {children}
    </AuthSplitShell>
  );
}
