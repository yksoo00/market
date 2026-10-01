import type { ReactNode } from "react";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { HomeAuthPane } from "@/components/auth/HomeAuthPane";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthSplitShell home={<HomeAuthPane />}>{children}</AuthSplitShell>;
}
