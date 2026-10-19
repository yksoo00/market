import Link from "next/link";
import { buildSearchHref, type SearchQuery } from "@/lib/search";
import { search } from "@/messages/search";

const t = search.scope;

// 검색 화면 맨 위 [전체 / 내 판매]. 검색어·필터는 그대로 두고 범위만 바꾼다 (같은 화면이라 칸 엔진이 그 칸에서 이동)
export function SearchScopeTabs({ query }: { query: SearchQuery }) {
  const tabs = [
    { mine: false, label: t.all },
    { mine: true, label: t.mine },
  ];
  return (
    <nav aria-label={t.label} className="self-start flex h-8.5 rounded-md border border-line bg-surface overflow-hidden">
      {tabs.map((tab, i) => {
        const current = query.mine === tab.mine;
        return (
          <Link
            key={tab.label}
            href={buildSearchHref({ ...query, mine: tab.mine })}
            aria-current={current ? "page" : undefined}
            className={`px-3.5 flex items-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
              current ? "bg-primary-soft text-primary-dark font-medium" : "text-ink-2 hover:bg-bg"
            } ${i > 0 ? "border-l border-line" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
