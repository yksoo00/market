"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { listingsApi } from "@/lib/api/listings";
import { fileUrl } from "@/lib/files";
import { formatPrice } from "@/lib/format";
import { formatRegDate } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import type { ListingMineItem } from "@/types/listing";

const t = my.listings;

type State =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "ready"; items: ListingMineItem[]; nextCursor: string | null };

const actionClass = "text-[13px] text-primary font-medium hover:underline";

/** 마이페이지의 내 판매글 목록. 구조는 ExtraPicker 와 같지만 행 모양·링크가 달라 따로 둔다 (세 번째 사용처가 생기면 공통화) */
export function MyListings() {
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
        <Link href="/listings/new" className={actionClass}>
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
            <Row item={item} />
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

function Row({ item }: { item: ListingMineItem }) {
  const base = `/listings/${item.userId}/${item.regDate}`;
  const done = item.tradeStatus === "completed";
  return (
    <div className="flex gap-3 px-3 py-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-md border border-line bg-bg flex items-center justify-center text-ink-3">
        {item.photo ? (
          // 서버 파일 주소는 next/image 원격 호스트 설정 대상이 아니다 (lib/files.ts)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(item.photo)} alt="" className="size-full object-cover" />
        ) : (
          <span title={t.noPhoto}>
            <Icon name="image" size={22} />
          </span>
        )}
      </div>
      <div className="min-w-0 grow flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-ink">{item.prodName}</span>
          <span
            className={`shrink-0 h-5 px-1.5 inline-flex items-center rounded-[5px] text-[11px] font-medium ${
              done ? "bg-line-2 text-ink-2" : "bg-primary-soft text-primary-dark"
            }`}
          >
            {done ? t.status.completed : t.status.available}
          </span>
        </div>
        <p className="truncate text-xs text-ink-2">
          {item.prodBrand}
          {item.prodNo && <span className="num"> · {item.prodNo}</span>}
        </p>
        <p className="flex flex-wrap items-baseline gap-x-3 text-xs text-ink-2">
          <span className="font-mono tabular-nums font-semibold text-ink">{formatPrice(item.salesUnitPrice)}</span>
          {item.salesQuantity !== null && <span>{t.quantity(item.salesQuantity)}</span>}
          <span className="num text-ink-3">{formatRegDate(item.regDate)}</span>
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href={base} className={actionClass}>
            {t.actions.detail}
          </Link>
          <Link href={`${base}/edit`} className={actionClass}>
            {t.actions.edit}
          </Link>
          <Link href={`${base}/extra`} className={actionClass}>
            {t.actions.extra}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-md border border-line animate-pulse" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-24 border-t border-line-2 first:border-t-0 px-3 flex items-center gap-3">
          <div className="size-14 rounded-md bg-line-2" />
          <div className="h-3 grow rounded bg-line-2" />
        </div>
      ))}
    </div>
  );
}
