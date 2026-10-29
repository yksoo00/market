"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { tradesApi } from "@/lib/api/trades";
import { buildSearchHref, type SearchQuery } from "@/lib/search";
import { scopeTabs, tabOf, withScope } from "@/lib/searchScope";
import { search } from "@/messages/search";
import type { TradeScopes } from "@/types/trade";

const t = search.scope;
const labels = { all: t.all, mine: t.mine, purchased: t.purchased };

// 검색 화면 맨 위 [전체 / 내 판매 / 내 구매]. 내 판매·내 구매 데이터가 있을 때만 해당 탭이 보이고, 둘 다 없거나 비로그인이면 줄이 없다.
// 검색어·필터는 그대로 두고 범위만 바꾼다 (같은 화면이라 칸 엔진이 그 칸에서 이동)
export function SearchScopeTabs({ query }: { query: SearchQuery }) {
  const [scopes, setScopes] = useState<TradeScopes | null>(null);
  useEffect(() => {
    let alive = true;
    // 실패(비로그인 401·네트워크)면 탭 줄 없이 전체 검색만 — 검색 자체는 막지 않는다
    void tradesApi.scopes().then((res) => {
      if (alive && res.ok) setScopes(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const current = tabOf(query);
  const tabs = scopeTabs(scopes, current);
  if (tabs.length === 0) return null;
  return (
    <nav aria-label={t.label} className="self-start flex h-8.5 rounded-md border border-line bg-surface overflow-hidden">
      {tabs.map((tab, i) => (
        <Link
          key={tab}
          href={buildSearchHref(withScope(query, tab))}
          aria-current={current === tab ? "page" : undefined}
          className={`px-3.5 flex items-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
            current === tab ? "bg-primary-soft text-primary-dark font-medium" : "text-ink-2 hover:bg-bg"
          } ${i > 0 ? "border-l border-line" : ""}`}
        >
          {labels[tab]}
        </Link>
      ))}
    </nav>
  );
}
