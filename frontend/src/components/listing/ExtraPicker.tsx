"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listingsApi } from "@/lib/api/listings";
import { formatRegDate } from "@/lib/listingDetail";
import { extraFilledLabel } from "@/lib/listingExtra";
import { listing } from "@/messages/listing";
import type { ListingMineItem } from "@/types/listing";

const t = listing.extra;

type State =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "ready"; items: ListingMineItem[]; nextCursor: string | null };

/** 추가등록 대상 고르기. 내 매물 목록 + [더 보기], 행을 누르면 그 매물의 입력 화면 */
export function ExtraPicker() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listingsApi.mine().then((res) => {
      if (!alive) return;
      setState(res.ok ? { kind: "ready", ...res.data } : { kind: "error", code: res.code });
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (state.kind === "loading") return <Skeleton />;
  if (state.kind === "error") {
    return (
      <div className="py-10 flex flex-col items-center gap-3 text-center">
        <p className="text-[15px] font-bold text-ink">{state.code === "RATE_LIMITED" ? listing.errors.RATE_LIMITED : listing.detail.loadFailed}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
          className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
        >
          {listing.detail.retry}
        </button>
      </div>
    );
  }
  if (state.items.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center gap-2 text-center">
        <p className="text-[15px] font-bold text-ink">{t.emptyTitle}</p>
        <Link href="/listings/new" className="text-[13px] text-primary font-medium hover:underline">
          {t.emptyAction}
        </Link>
      </div>
    );
  }

  const { items, nextCursor } = state;
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreFailed(null);
    const res = await listingsApi.mine(nextCursor);
    setLoadingMore(false);
    // 실패해도 이미 보이는 목록은 그대로 둔다
    if (res.ok) setState({ kind: "ready", items: [...items, ...res.data.items], nextCursor: res.data.nextCursor });
    else setMoreFailed(res.code === "RATE_LIMITED" ? listing.errors.RATE_LIMITED : t.moreFailed);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="rounded-md border border-line">
        {items.map((item, i) => (
          <li key={`${item.userId}/${item.regDate}`} className={i > 0 ? "border-t border-line-2" : ""}>
            <Link
              href={`/listings/${item.userId}/${item.regDate}/extra`}
              className="flex flex-col @md:flex-row @md:items-center gap-1 @md:gap-4 px-3 py-3 hover:bg-bg"
            >
              <span className="min-w-0 grow flex flex-col">
                <span className="truncate text-sm font-medium text-ink">{item.prodName}</span>
                <span className="truncate text-xs text-ink-2">
                  {item.prodBrand}
                  {item.prodNo && <span className="num"> · {item.prodNo}</span>}
                </span>
              </span>
              <span className="num text-xs text-ink-3">{formatRegDate(item.regDate)}</span>
              <span
                className={`shrink-0 h-5 px-1.5 inline-flex items-center rounded-[5px] text-[11px] font-medium ${
                  item.extraFilled > 0 ? "bg-primary-soft text-primary-dark" : "bg-line-2 text-ink-2"
                }`}
              >
                {extraFilledLabel(item.extraFilled)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {nextCursor && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none"
          >
            {t.loadMore}
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

function Skeleton() {
  return (
    <div className="rounded-md border border-line animate-pulse" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-14 border-t border-line-2 first:border-t-0 px-3 flex items-center">
          <div className="h-3 w-full rounded bg-line-2" />
        </div>
      ))}
    </div>
  );
}
