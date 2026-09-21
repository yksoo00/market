"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { personalSignupFlow, personalSignupPath, type PersonalSignupState } from "@/lib/signupFlow";

interface Props {
  /** 이 페이지에 오려면 채워져 있어야 하는 것. 서버 컴포넌트에서 넘기므로 함수가 아니라 키 목록 */
  require: (keyof PersonalSignupState)[];
  redirectTo?: string;
  children: ReactNode;
}

const noop = () => () => {};

/** 앞 단계를 건너뛰고 URL 로 직접 들어오면 첫 단계로 돌려보낸다. 서버·하이드레이션 중엔 아무것도 안 그림 */
export function StepGuard({ require, redirectTo = personalSignupPath.verify, children }: Props) {
  const router = useRouter();
  // sessionStorage 는 브라우저에만 있으므로 서버 스냅샷은 "미정"(null)
  const key = require.join(",");
  const ok = useSyncExternalStore<boolean | null>(
    noop,
    () => {
      const state = personalSignupFlow.get();
      return key.split(",").every((k) => Boolean(state[k as keyof PersonalSignupState]));
    },
    () => null,
  );

  useEffect(() => {
    if (ok === false) router.replace(redirectTo);
  }, [ok, redirectTo, router]);

  return ok ? <>{children}</> : null;
}
