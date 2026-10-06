"use client";

import { useEffect, useRef, useState } from "react";
import { RowEditor } from "@/components/my/RowEditor";
import { ResultList } from "@/components/search/ResultList";
import { authApi } from "@/lib/api/auth";
import { listingsApi } from "@/lib/api/listings";
import { applyDetailToItem } from "@/lib/rowEdit";
import type { SearchQuery, SearchScope } from "@/lib/search";
import { search as t } from "@/messages/search";
import type { ListingSearchItem } from "@/types/listing";

const r = t.result;

type State =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "ready"; items: ListingSearchItem[]; nextCursor: string | null; total: number };

// 검색 결과는 클라이언트 조회 (decisions.md 2026-10-02 매물 검색). 조건이 바뀌면 페이지가 key 로 다시 마운트한다
export function SearchResults({
  query: initialQuery,
  scope = "search",
  onEditingChange,
}: {
  query: SearchQuery;
  scope?: SearchScope;
  /** 내 판매글: 행 수정을 시작·끝낼 때. 부모가 수정 중에 검색창·필터를 숨긴다 */
  onEditingChange?: (editing: boolean) => void;
}) {
  // 같은 URL 로 다시 이동해도 서버가 새 query 객체를 주므로, 마운트 때 값으로 고정해 [더 보기]로 쌓은 결과가 조용히 리셋되지 않게
  const [query] = useState(initialQuery);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState<string | null>(null);
  // 내 판매글(mine): 수정 중인 행. 있으면 목록 대신 그 행의 편집기만 보인다 (다른 행·[더 보기]는 숨김)
  const [editing, setEditing] = useState<ListingSearchItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  // 내 판매글: 내 글에만 [수정]을 그리려고 로그인한 사용자 id 를 안다 (아직 모르면 버튼을 그리지 않는다)
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    if (scope !== "mine") return;
    let alive = true;
    void authApi.me().then((res) => {
      if (alive && res.ok) setMeId(res.data.id);
    });
    return () => {
      alive = false;
    };
  }, [scope]);
  // 뒤로가기 등으로 이 화면이 다시 마운트되면 부모가 "수정 중"으로 남지 않게
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  // 수정을 시작·끝낼 때 칸(main)의 스크롤 위치를 되돌려 보던 자리로 돌아오게
  const scroller = () => rootRef.current?.closest("main") ?? null;
  const startEdit = (item: ListingSearchItem) => {
    savedScroll.current = scroller()?.scrollTop ?? 0;
    setEditing(item);
    onEditingChange?.(true);
    scroller()?.scrollTo({ top: 0 });
  };
  const stopEdit = () => {
    setEditing(null);
    onEditingChange?.(false);
    requestAnimationFrame(() => scroller()?.scrollTo({ top: savedScroll.current }));
  };

  useEffect(() => {
    let alive = true;
    void listingsApi.search(query, undefined, scope).then((res) => {
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
      </div>
    );
  }

  const { items, nextCursor, total } = state;
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreFailed(null);
    const res = await listingsApi.search(query, nextCursor, scope);
    setLoadingMore(false);
    // 실패해도 이미 보이는 결과는 그대로 둔다. 429 는 계속 누르면 한도만 늘어나니 기다리라고 알린다
    // 함수형 갱신 — 그사이 행 수정을 저장했다면 그 갱신 위에 이어 붙인다
    if (res.ok) {
      setState((prev) =>
        prev.kind === "ready"
          ? { kind: "ready", items: [...prev.items, ...res.data.items], nextCursor: res.data.nextCursor, total: res.data.total }
          : prev,
      );
    }
    else setMoreFailed(res.code === "RATE_LIMITED" ? r.rateLimited : r.moreFailed);
  };

  if (editing) {
    return (
      <div ref={rootRef}>
        <RowEditor
          item={editing}
          onCancel={stopEdit}
          onSaved={(detail) => {
            // 저장 응답으로 그 행만 갱신 (새 상품으로 옮겨졌으면 그 상품 값)
            setState({
              kind: "ready",
              items: items.map((i) => (i.userId === editing.userId && i.regDate === editing.regDate ? applyDetailToItem(i, detail) : i)),
              nextCursor,
              total,
            });
            stopEdit();
          }}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="contents">
      <ResultList items={items} query={query} total={total} scope={scope} onEdit={scope === "mine" ? startEdit : undefined} ownerId={meId} />
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
    </div>
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
