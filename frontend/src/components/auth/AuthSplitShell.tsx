"use client";

import { startTransition, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { SignupChoosePanel } from "@/components/auth/SignupChoosePanel";
import { Icon } from "@/components/common/Icon";
import { useIsFramed } from "@/hooks/useIsFramed";
import { safeNext } from "@/lib/safeNext";
import { common as t } from "@/messages/common";

// 로그인 ↔ 가입으로 이동할 때 떠나온 화면을 위 칸에 남긴다. 가입은 유형 선택(/signup)에만 로그인 링크가 있다.
type PreviousPane =
  | { kind: "login"; next: string; initial: "personal" | "business"; search: string }
  | { kind: "signup" };

interface Props {
  children: ReactNode;
  home: ReactNode;
}

export function AuthSplitShell({ children, home }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const framed = useIsFramed();
  const [previous, setPrevious] = useState<PreviousPane | null>(null);

  const handleNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const nextPath = new URL(anchor.href).pathname;

    if (pathname === "/login" && nextPath.startsWith("/signup")) {
      const params = new URLSearchParams(window.location.search);
      setPrevious({
        kind: "login",
        next: safeNext(params.get("next") ?? undefined),
        initial: params.get("type") === "business" ? "business" : "personal",
        // 돌아갈 때 원래 주소 그대로 복원한다 (next가 없던 /login이 ?next=%2F로 바뀌지 않게)
        search: window.location.search,
      });
    } else if (pathname === "/signup" && nextPath === "/login") {
      setPrevious({ kind: "signup" });
    } else {
      // 같은 흐름 안의 이동(/signup → /signup/personal 등)은 위 칸을 유지하고, 흐름을 벗어나면 닫는다
      const section = pathname.startsWith("/signup") ? "/signup" : "/login";
      if (!nextPath.startsWith(section)) setPrevious(null);
    }
  };

  // 현재 경로 칸 닫기. 분할이면 현재 칸을 닫고 위 칸(떠나온 화면)으로 돌아가고, 단일 칸이면 홈으로.
  const closeCurrent = () => {
    // 위 칸 정리와 이동을 한 transition으로 묶어, 이동이 끝나기 전에 현재 칸만 단독으로 커져 보이는 깜빡임을 막는다
    if (previous?.kind === "login") {
      startTransition(() => {
        setPrevious(null);
        router.push(`/login${previous.search}`);
      });
    } else if (previous?.kind === "signup") {
      startTransition(() => {
        setPrevious(null);
        router.push("/signup");
      });
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
      {/* 안쪽 래퍼도 flex justify-center: AuthCard는 max-w-[420px]라 560 래퍼 안에서 왼쪽에 붙지 않게 */}
      <div
        onClick={handleNavigation}
        className={previous ? "min-h-0 grid grid-rows-2 divide-y divide-line" : "min-h-0 flex"}
      >
        {previous && (
          // 닫기 버튼은 스크롤 영역 바깥 래퍼에 둬야 칸을 스크롤해도 우상단에 고정된다
          <div className="relative min-h-0">
            <section className="h-full overflow-y-auto px-4 py-6 @md:px-6 @md:py-8 flex justify-center">
              <div className="w-full max-w-[560px] my-auto flex justify-center">
                {previous.kind === "login" ? (
                  <LoginPanel next={previous.next} initial={previous.initial} />
                ) : (
                  <SignupChoosePanel />
                )}
              </div>
            </section>
            {!framed && <PaneCloseButton onClick={() => setPrevious(null)} />}
          </div>
        )}
        <div className="relative flex-1 min-w-0 min-h-0">
          <section className="h-full overflow-y-auto px-4 py-6 @md:px-6 @md:py-8 flex justify-center">
            <div className="w-full max-w-[560px] my-auto flex justify-center">{children}</div>
          </section>
          {/* 단일 칸일 때는 왼쪽 홈 칸이 보이는 @lg에서만 닫기를 둔다. 좁으면 이 칸이 화면 전체라 닫을 대상이 아니다 */}
          {!framed && <PaneCloseButton onClick={closeCurrent} className={previous ? "flex" : "hidden @lg:flex"} />}
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
      className={`${className} absolute top-2 right-4 w-7 h-7 items-center justify-center rounded-full bg-surface text-ink border border-line hover:border-primary`}
    >
      <Icon name="close" size={14} />
    </button>
  );
}
