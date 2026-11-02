"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pager } from "@/components/common/Pager";
import { ResultList } from "@/components/search/ResultList";
import { listingsApi } from "@/lib/api/listings";
import { tradesApi } from "@/lib/api/trades";
import { replaceRow } from "@/lib/rowEdit";
import { buildSearchHref, type SearchQuery, type SearchScope } from "@/lib/search";
import { search as t } from "@/messages/search";
import type { ListingSearchItem } from "@/types/listing";
import type { PendingCounts } from "@/types/trade";

const r = t.result;

type State =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "ready"; items: ListingSearchItem[]; total: number; page: number; totalPages: number };

// 검색 결과는 클라이언트 조회 (decisions.md 2026-10-02 매물 검색). 조건이 바뀌면 페이지가 key 로 다시 마운트한다
export function SearchResults({
  query: initialQuery,
  scope = "search",
}: {
  query: SearchQuery;
  scope?: SearchScope;
}) {
  // 같은 URL 로 다시 이동해도 서버가 새 query 객체를 주므로, 마운트 때 값으로 고정해 구매 뒤 갱신한 행이 조용히 리셋되지 않게
  const [query] = useState(initialQuery);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // 내 판매글: 매물별 구매요청 건수. 매물 검색 응답이 아니라 거래 API 에서 따로 받는다 (매물 → 거래 순환 의존 방지).
  // 실패하면 건수 칸이 비어 보일 뿐 목록은 그대로
  const [pendingCounts, setPendingCounts] = useState<PendingCounts | null>(null);
  useEffect(() => {
    if (scope !== "mine") return;
    let alive = true;
    void tradesApi.pendingCounts().then((res) => {
      if (alive && res.ok) setPendingCounts(res.data);
    });
    return () => {
      alive = false;
    };
  }, [scope]);
  useEffect(() => {
    let alive = true;
    void listingsApi.search(query, scope).then((res) => {
      if (!alive) return;
      if (res.ok) setState({ kind: "ready", ...res.data });
      else setState({ kind: "error", code: res.code });
    });
    return () => {
      alive = false;
    };
  }, [query, scope, attempt]);

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
        {query.page > 1 && (
          <Link href={buildSearchHref({ ...query, page: 1 }, scope)} className="text-[13px] text-primary font-medium hover:underline">
            {r.firstPage}
          </Link>
        )}
      </div>
    );
  }

  const { items, total, page, totalPages } = state;

  // 구매 성공 뒤 그 매물만 다시 읽어 재고·거래상태를 맞춘다. 실패하면 그대로 둔다 — 구매는 이미 성공했고
  // 다음 검색에서 맞춰진다
  const refreshRow = async (key: { userId: string; regDate: string }) => {
    const res = await listingsApi.get(key.userId, key.regDate);
    if (res.ok) setState((prev) => (prev.kind === "ready" ? { ...prev, items: replaceRow(prev.items, res.data) } : prev));
  };

  return (
    <>
      <ResultList items={items} query={query} total={total} scope={scope} pendingCounts={pendingCounts} onPurchased={refreshRow} />
      <Pager page={page} totalPages={totalPages} hrefFor={(n) => buildSearchHref({ ...query, page: n }, scope)} />
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
