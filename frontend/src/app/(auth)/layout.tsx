import type { ReactNode } from "react";
import { Header } from "@/components/common/Header";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { HomeAuthPane } from "@/components/auth/HomeAuthPane";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header hideAuthLinks />
      <AuthSplitShell home={<HomeAuthPane />}>{children}</AuthSplitShell>
    </>
  );
}
