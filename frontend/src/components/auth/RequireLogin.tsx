"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";

/**
 * 로그인해야 쓰는 화면. 비로그인이면 로그인 화면으로 보내고 돌아올 경로를 next 로 넘긴다
 * (RedirectIfAuthenticated 의 반대). 화면 표시용 확인일 뿐 실제 권한은 서버 401.
 */
export function RequireLogin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void authApi.me().then((result) => {
      if (!active) return;
      if (!result.ok) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  return checked ? children : null;
}
