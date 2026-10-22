"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/common/Icon";
import { useIsFramed } from "@/hooks/useIsFramed";
import { home as t } from "@/messages/home";

const tabs: { icon: IconName; label: string; href: string; center?: boolean }[] = [
  { icon: "home", label: t.tabs.home, href: "/" },
  // 매물 목록 화면은 따로 없다 — 검색 결과가 그 역할. 내 정보는 마이페이지 (/listings·/me 는 없는 경로라 404 였다)
  { icon: "sell", label: t.tabs.listings, href: "/search" },
  { icon: "plus", label: t.tabs.post, href: "/listings/new", center: true },
  { icon: "user", label: t.tabs.me, href: "/my" },
];

export function MobileTabBar({ active = "/" }: { active?: string }) {
  const framed = useIsFramed();
  if (framed) return null;

  return (
    // 칸 폭(@md)이 아니라 화면 폭(md) 기준 — 분할 기준(useIsWide, 화면 768)과 같다. 칸 폭으로 보면 PC 분할의 좁은 주기능 칸에도 탭바가 떴다.
    // framed:hidden — iframe 칸은 위 JS 확인이 하이드레이션 뒤에야 돌아, 그 전에 잠깐 보이지 않게 CSS 로도 숨긴다
    <nav className="md:hidden framed:hidden h-15 shrink-0 grid grid-cols-4 bg-surface border-t border-line text-[10px] pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ icon, label, href, center }) => {
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-[3px] ${on ? "text-primary" : "text-ink-2"}`}
          >
            {center ? (
              <span className="w-10 h-10 -mt-3.5 rounded-full bg-primary text-white flex items-center justify-center">
                <Icon name={icon} strokeWidth={2.2} />
              </span>
            ) : (
              <Icon name={icon} strokeWidth={on ? 2 : 1.7} />
            )}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
