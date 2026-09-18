import Link from "next/link";
import { Icon } from "@/components/common/Icon";
import { home as t } from "@/messages/home";

const navHrefs = ["/listings", "/requests", "/prices", "/business", "/support"];

export function Header() {
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
      <Link href="/login" className="text-[13px] text-on-primary hover:text-white">
        {t.login}
      </Link>
      <Link
        href="/signup"
        className="hidden md:flex h-[34px] px-3.5 items-center rounded-md bg-green text-white text-[13px] font-bold"
      >
        {t.signup}
      </Link>
    </header>
  );
}
