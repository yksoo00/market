"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import { UserMenu } from "@/components/common/UserMenu";
import { useIsFramed } from "@/hooks/useIsFramed";
import { authApi } from "@/lib/api/auth";
import { screenOf } from "@/lib/tileScreens";
import { home as t } from "@/messages/home";

const navHrefs = ["/listings", "/requests", "/prices", "/business", "/support"];

export function Header() {
  // 경로 전체가 아니라 "로그인 화면인가"만 본다 (아래 effect 주석)
  // 로그인은 타일 큐의 칸(iframe)에서도 일어나므로 주소창 칸이든 다른 칸이든 로그인 화면이 열려 있는지를 본다
  const { panes } = useTileWorkspace();
  const onLoginPage = usePathname() === "/login" || panes.some((p) => screenOf(p.path).id === "login");
  const framed = useIsFramed();
  const [profile, setProfile] = useState<{ nickname: string; kind: "PERSONAL" | "BUSINESS" } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // 서브 타일(iframe) 안에서는 헤더 자체를 안 그리므로 세션 조회도 건너뛴다.
    if (framed) return;
    let active = true;
    void authApi.me().then((result) => {
      if (!active) return;
      setProfile(result.ok ? result.data : null);
      setSessionChecked(true);
    });
    return () => {
      active = false;
    };
    // 헤더가 루트 레이아웃에 있어 페이지를 옮겨도 다시 마운트되지 않는다. 로그인은 /login을 벗어나는
    // 이동으로 끝나므로, /login에 들어오고 나갈 때만 세션을 다시 확인한다. 경로가 바뀔 때마다 조회하면
    // 비로그인 사용자는 이동마다 401 + refresh 시도 요청이 나간다.
  }, [framed, onLoginPage]);

  if (framed) return null;

  return (
    <header data-hide-in-tile className="h-13 md:h-14 shrink-0 px-4 md:px-6 flex items-center gap-7 bg-primary text-white">
      {/* 로고는 타일 큐를 항상 리셋(홈 전체화면). 나머지 헤더 링크는 일반 규칙 */}
      <Link href="/" data-tile="reset" className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-md bg-green flex items-center justify-center">
          <Icon name="logo" size={17} strokeWidth={2.2} />
        </span>
        <span className="text-lg font-bold tracking-tight">{t.brand}</span>
      </Link>

      <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
        {t.nav.map((label, i) => (
          <Link key={label} href={navHrefs[i]} className="text-on-primary hover:text-white">
            {label}
          </Link>
        ))}
      </nav>

      <span className="grow" />

      <Link href="/notifications" aria-label="알림" className="md:hidden w-11 h-11 flex items-center justify-center text-on-primary">
        <Icon name="bell" />
      </Link>
      {profile ? (
        <UserMenu
          nickname={profile.nickname}
          kind={profile.kind}
          onLoggedOut={() => {
            setProfile(null);
            setSessionChecked(true);
          }}
        />
      ) : sessionChecked ? (
        <>
          <Link href="/login" className="text-[13px] text-on-primary hover:text-white">
            {t.login}
          </Link>
          <Link
            href="/signup"
            className="hidden md:flex h-[34px] px-3.5 items-center rounded-md bg-green text-white text-[13px] font-bold"
          >
            {t.signup}
          </Link>
        </>
      ) : (
        <span aria-hidden="true" className="w-14" />
      )}
    </header>
  );
}
