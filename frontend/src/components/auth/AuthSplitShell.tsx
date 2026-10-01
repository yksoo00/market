"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { Icon } from "@/components/common/Icon";
import { useIsFramed } from "@/hooks/useIsFramed";
import { safeNext } from "@/lib/safeNext";
import { common as t } from "@/messages/common";

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
  const router = useRouter();
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

  // 현재 경로 칸 닫기. 분할(이전 로그인 + 가입)이면 가입을 닫고 그 로그인 화면으로, 단일 칸이면 홈으로.
  const closeCurrent = () => {
    if (previousLogin) {
      const params = new URLSearchParams({ next: previousLogin.next });
      if (previousLogin.initial === "business") params.set("type", "business");
      setPreviousLogin(null);
      router.push(`/login?${params}`);
    } else {
      router.push("/");
    }
  };

  return (
    <main
      className={
        framed
          ? "relative flex-1 min-h-0 overflow-y-auto"
          : "relative flex-1 min-h-0 overflow-y-auto @lg:overflow-hidden @lg:grid @lg:grid-cols-2"
      }
    >
      {/* 서브 타일(iframe) 안에서는 항상 숨김. 그 외엔 @lg: 라 메인이 타일에 밀려 좁아지면(창 폭과 무관하게) 자동으로 접힌다 */}
      <div className={framed ? "hidden" : "hidden @lg:block min-h-0 overflow-y-auto border-r border-line bg-bg"}>
        {home}
      </div>
      {/* 칸 가운데 정렬은 items-center 대신 자식의 my-auto로 한다. items-center는 내용이 칸보다 길면
          위쪽까지 넘쳐 스크롤로도 닿지 않지만, auto margin은 넘칠 때 0이 되어 위에서부터 스크롤된다 */}
      <div
        onClick={handleNavigation}
        className={previousLogin ? "min-h-0 grid grid-rows-2 divide-y divide-line" : "min-h-0 flex"}
      >
        {previousLogin && (
          // 닫기 버튼은 스크롤 영역 바깥 래퍼에 둬야 칸을 스크롤해도 우상단에 고정된다
          <div className="relative min-h-0">
            <section className="h-full overflow-y-auto px-4 py-5 @md:px-6 @md:py-6 flex justify-center">
              <div className="w-full max-w-[560px] my-auto">
                <LoginPanel next={previousLogin.next} initial={previousLogin.initial} />
              </div>
            </section>
            {!framed && <PaneCloseButton onClick={() => setPreviousLogin(null)} />}
          </div>
        )}
        <div className="relative flex-1 min-w-0 min-h-0">
          <section className="h-full overflow-y-auto px-4 py-6 @md:px-6 @md:py-8 flex justify-center">
            <div className="w-full max-w-[560px] my-auto">{children}</div>
          </section>
          {/* 단일 칸일 때는 왼쪽 홈 칸이 보이는 @lg에서만 닫기를 둔다. 좁으면 이 칸이 화면 전체라 닫을 대상이 아니다 */}
          {!framed && <PaneCloseButton onClick={closeCurrent} className={previousLogin ? "flex" : "hidden @lg:flex"} />}
        </div>
      </div>
    </main>
  );
}

function PaneCloseButton({ onClick, className = "flex" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={t.tileClose}
      onClick={onClick}
      className={`${className} absolute top-2 right-4 w-7 h-7 items-center justify-center rounded-full bg-surface text-ink border border-line shadow-sm hover:border-primary`}
    >
      <Icon name="close" size={14} />
    </button>
  );
}
