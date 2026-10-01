"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useIsFramed } from "@/hooks/useIsFramed";
import { authApi } from "@/lib/api/auth";
import { home as t } from "@/messages/home";

const navHrefs = ["/listings", "/requests", "/prices", "/business", "/support"];

export function Header() {
  const pathname = usePathname();
  const framed = useIsFramed();
  const [profile, setProfile] = useState<{ nickname: string } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

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
    // 헤더가 루트 레이아웃에 있어 페이지를 옮겨도 다시 마운트되지 않는다. 로그인 후 이동 등으로
    // 경로가 바뀔 때 세션을 다시 확인해야 "로그인" 표시가 남지 않는다.
  }, [framed, pathname]);

  const logout = async () => {
    setLoggingOut(true);
    setLogoutError(false);
    const result = await authApi.logout();
    if (result.ok) {
      setProfile(null);
      setSessionChecked(true);
    } else {
      setLogoutError(true);
    }
    setLoggingOut(false);
  };

  if (framed) return null;

  return (
    <header className="h-13 md:h-14 shrink-0 px-4 md:px-6 flex items-center gap-7 bg-primary text-white">
      <Link href="/" className="flex items-center gap-2">
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
        <div className="flex items-center gap-3">
          <span className="max-w-36 truncate text-[13px] font-semibold text-white" title={profile.nickname}>
            {profile.nickname}님
          </span>
          <button type="button" onClick={() => void logout()} disabled={loggingOut} className="text-[13px] text-on-primary hover:text-white disabled:opacity-60">
            {loggingOut ? "로그아웃 중…" : "로그아웃"}
          </button>
          {logoutError && <span role="alert" className="text-xs text-white">로그아웃 실패</span>}
        </div>
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
