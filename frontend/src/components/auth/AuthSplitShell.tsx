"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { useIsFramed } from "@/hooks/useIsFramed";
import { safeNext } from "@/lib/safeNext";

interface LoginPaneState {
  next: string;
  initial: "personal" | "business";
}

interface Props {
  children: ReactNode;
  home: ReactNode;
}

export function AuthSplitShell({ children, home }: Props) {
  const pathname = usePathname();
  const framed = useIsFramed();
  const [previousLogin, setPreviousLogin] = useState<LoginPaneState | null>(null);

  const handleNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const nextPath = new URL(anchor.href).pathname;

    if (pathname === "/login" && nextPath.startsWith("/signup")) {
      const params = new URLSearchParams(window.location.search);
      setPreviousLogin({
        next: safeNext(params.get("next") ?? undefined),
        initial: params.get("type") === "business" ? "business" : "personal",
      });
    } else if (pathname.startsWith("/signup") && !nextPath.startsWith("/signup")) {
      setPreviousLogin(null);
    }
  };

  return (
    <main
      className={
        framed
          ? "relative flex-1 min-h-0 overflow-y-auto"
          : "relative flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-2"
      }
    >
      {/* 서브 타일(iframe) 안에서는 뷰포트가 넓어도 홈 미리보기 없이 폼만 보인다 — 실제 폭은 좁은데 lg: 레이아웃이 켜지는 걸 막는다 */}
      <div className={framed ? "hidden" : "hidden lg:block min-h-0 overflow-y-auto border-r border-line bg-bg"}>
        {home}
      </div>
      <div
        onClick={handleNavigation}
        className={previousLogin ? "min-h-0 grid grid-rows-2 divide-y divide-line" : "min-h-0 flex items-center justify-center"}
      >
        {previousLogin && (
          <section className="min-h-0 overflow-y-auto px-4 py-5 md:px-6 md:py-6 flex items-center justify-center">
            <div className="w-full max-w-[560px]">
              <LoginPanel next={previousLogin.next} initial={previousLogin.initial} />
            </div>
          </section>
        )}
        <section className="min-h-0 overflow-y-auto px-4 py-6 md:px-6 md:py-8 flex items-center justify-center">
          <div className="w-full max-w-[560px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
