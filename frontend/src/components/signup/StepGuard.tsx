"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  businessSignupFlow,
  businessSignupPath,
  personalSignupFlow,
  personalSignupPath,
  type BusinessSignupState,
  type PersonalSignupState,
} from "@/lib/signupFlow";

type Props =
  | { kind: "personal"; require: (keyof PersonalSignupState)[]; children: ReactNode }
  | { kind: "business"; require: (keyof BusinessSignupState)[]; children: ReactNode };

const noop = () => () => {};

/** 앞 단계를 건너뛰고 URL 로 직접 들어오면 첫 단계로 돌려보낸다. 서버·하이드레이션 중엔 아무것도 안 그림 */
export function StepGuard({ kind, require, children }: Props) {
  const router = useRouter();
  const key = require.join(",");
  // sessionStorage 는 브라우저에만 있으므로 서버 스냅샷은 "미정"(null)
  const ok = useSyncExternalStore<boolean | null>(
    noop,
    () => {
      const state: Partial<Record<string, unknown>> = kind === "personal" ? { ...personalSignupFlow.get() } : { ...businessSignupFlow.get() };
      return key.split(",").every((k) => Boolean(state[k]));
    },
    () => null,
  );
  const redirectTo = kind === "personal" ? personalSignupPath.verify : businessSignupPath.terms;

  useEffect(() => {
    if (ok === false) router.replace(redirectTo);
  }, [ok, redirectTo, router]);

  return ok ? <>{children}</> : null;
}
