"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FormError } from "@/components/auth/FormStatus";
import { authApi } from "@/lib/api/auth";
import { common } from "@/messages/common";

// 로그인 안 됨으로 보는 코드. 그 외(서버 장애·네트워크)는 로그인된 사용자도 받을 수 있어 로그인 화면으로 보내지 않는다
const NOT_LOGGED_IN = new Set(["UNAUTHORIZED", "UNAUTHENTICATED", "SESSION_EXPIRED"]);

/**
 * 로그인해야 쓰는 화면. 비로그인이면 로그인 화면으로 보내고 돌아올 경로를 next 로 넘긴다
 * (RedirectIfAuthenticated 의 반대). 화면 표시용 확인일 뿐 실제 권한은 서버 401.
 */
export function RequireLogin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"checking" | "ok" | "error">("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void authApi.me().then((result) => {
      if (!active) return;
      if (result.ok) setState("ok");
      else if (NOT_LOGGED_IN.has(result.code)) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      else setState("error");
    });
    return () => {
      active = false;
    };
  }, [pathname, router, attempt]);

  if (state === "error") {
    return (
      <FormError
        message={common.unreachable}
        onRetry={() => {
          setState("checking");
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return state === "ok" ? children : null;
}
