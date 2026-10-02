import Link from "next/link";
import { Icon } from "@/components/common/Icon";
import { popularQueries } from "@/lib/mock/home";
import { MAX_QUERY } from "@/lib/search";
import { home as t } from "@/messages/home";

export function SearchBox() {
  return (
    <form action="/search" className="w-full flex flex-col gap-2.5 @md:gap-3">
      <label htmlFor="q" className="sr-only">
        {t.search.label}
      </label>
      <div className="h-11 @md:h-14 flex items-stretch rounded-md @md:rounded-lg border-2 border-primary bg-surface overflow-hidden">
        {/* 카테고리 select 보류: 카테고리 마스터 미정 (decisions.md 2026-10-02 매물 검색) — 정해지면 복원 */}
        <div className="grow min-w-0 flex items-center gap-2.5 px-3 @md:px-3.5 text-ink-2">
          <Icon name="search" strokeWidth={2} />
          <input
            id="q"
            name="q"
            type="search"
            maxLength={MAX_QUERY}
            placeholder={t.search.placeholder}
            className="grow min-w-0 bg-transparent outline-none text-[15px] @md:text-[17px] text-ink placeholder:text-ink-3"
          />
        </div>
        <button
          type="submit"
          className="w-16 @md:w-26 bg-primary text-white text-sm @md:text-base font-bold hover:bg-primary-dark"
        >
          {t.search.button}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-ink-3 overflow-hidden max-h-5">
        <span>{t.search.popularLabel}</span>
        {popularQueries.map((q) => (
          <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="text-ink-2 font-medium hover:text-primary">
            {q}
          </Link>
        ))}
      </div>
    </form>
  );
}
