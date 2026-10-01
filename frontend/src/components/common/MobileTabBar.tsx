"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/common/Icon";
import { useIsFramed } from "@/hooks/useIsFramed";
import { home as t } from "@/messages/home";

const tabs: { icon: IconName; label: string; href: string; center?: boolean }[] = [
  { icon: "home", label: t.tabs.home, href: "/" },
  { icon: "sell", label: t.tabs.listings, href: "/listings" },
  { icon: "plus", label: t.tabs.post, href: "/listings/new", center: true },
  { icon: "chat", label: t.tabs.chat, href: "/chats" },
  { icon: "user", label: t.tabs.me, href: "/me" },
];

export function MobileTabBar({ active = "/" }: { active?: string }) {
  const framed = useIsFramed();
  if (framed) return null;

  return (
    <nav className="@md:hidden h-15 shrink-0 grid grid-cols-5 bg-surface border-t border-line text-[10px] pb-[env(safe-area-inset-bottom)]">
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
