"use client";

import { useEffect, useState } from "react";
import { ResultList } from "@/components/search/ResultList";
import { listingsApi } from "@/lib/api/listings";
import type { SearchQuery } from "@/lib/search";
import { search as t } from "@/messages/search";
import type { ListingSearchItem } from "@/types/listing";

const r = t.result;

type State =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "ready"; items: ListingSearchItem[]; nextCursor: string | null; total: number };

// 검색 결과는 클라이언트 조회 (decisions.md 2026-10-02 매물 검색). 조건이 바뀌면 페이지가 key 로 다시 마운트한다
export function SearchResults({ query: initialQuery }: { query: SearchQuery }) {
  // 같은 URL 로 다시 이동해도 서버가 새 query 객체를 주므로, 마운트 때 값으로 고정해 [더 보기]로 쌓은 결과가 조용히 리셋되지 않게
  const [query] = useState(initialQuery);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listingsApi.search(query).then((res) => {
      if (!alive) return;
      if (res.ok) setState({ kind: "ready", ...res.data });
      else setState({ kind: "error", code: res.code });
    });
    return () => {
      alive = false;
    };
  }, [query, attempt]);

  if (state.kind === "loading") return <Skeleton />;
  if (state.kind === "error") {
    const retry = () => {
      setState({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        <p className="text-[15px] font-bold text-ink">{state.code === "RATE_LIMITED" ? r.rateLimited : r.loadFailed}</p>
        <button type="button" onClick={retry} className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft">
          {r.retry}
        </button>
      </div>
    );
  }

  const { items, nextCursor, total } = state;
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreFailed(null);
    const res = await listingsApi.search(query, nextCursor);
    setLoadingMore(false);
    // 실패해도 이미 보이는 결과는 그대로 둔다. 429 는 계속 누르면 한도만 늘어나니 기다리라고 알린다
    if (res.ok) setState({ kind: "ready", items: [...items, ...res.data.items], nextCursor: res.data.nextCursor, total: res.data.total });
    else setMoreFailed(res.code === "RATE_LIMITED" ? r.rateLimited : r.moreFailed);
  };

  return (
    <>
      <ResultList items={items} query={query} total={total} />
      {nextCursor && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none"
          >
            {r.more}
          </button>
          {moreFailed && (
            <span role="alert" className="text-[13px] text-down">
              {moreFailed}
            </span>
          )}
        </div>
      )}
    </>
  );
}

// 결과 표 행 높이(44)를 유지해 내용이 들어올 때 화면이 덜 흔들리게 (design.md "상태")
function Skeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse" aria-busy="true">
      <div className="h-8.5 w-40 rounded-md bg-line-2" />
      <div className="rounded-md border border-line bg-surface">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-11 border-t border-line-2 first:border-t-0 px-4 flex items-center">
            <div className="h-3 w-full rounded bg-line-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
