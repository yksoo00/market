"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListingEditForm } from "@/components/listing/ListingEditForm";
import { authApi } from "@/lib/api/auth";
import { listingsApi } from "@/lib/api/listings";
import { isOwner, isValidListingPath } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;

type State =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "error" }
  | { kind: "forbidden" }
  | { kind: "ready"; detail: ListingDetail };

/**
 * 수정 화면의 조회. 로그인 확인(RequireLogin)은 바깥이 하고, 여기선 매물과 내 id 로 "내 매물인가"를 본다.
 * 남의 매물이면 폼을 그리지 않는다 — 판단은 표시용이고 실제 권한은 PATCH 의 403 이다.
 */
export function EditListingView({ userId, regDate }: { userId: string; regDate: string }) {
  const valid = isValidListingPath(userId, regDate);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    void Promise.all([listingsApi.get(userId, regDate), authApi.me()]).then(([res, me]) => {
      if (!alive) return;
      if (!res.ok) return setState({ kind: res.code === "LISTING_NOT_FOUND" ? "notFound" : "error" });
      if (!me.ok) return setState({ kind: "error" });
      setState(isOwner(me.data.id, res.data.userId) ? { kind: "ready", detail: res.data } : { kind: "forbidden" });
    });
    return () => {
      alive = false;
    };
  }, [userId, regDate, valid, attempt]);

  if (!valid || state.kind === "notFound") {
    return (
      <Notice text={t.notFound}>
        <Link href="/search" className="text-[13px] text-primary font-medium hover:underline">
          {t.toSearch}
        </Link>
      </Notice>
    );
  }
  if (state.kind === "loading") return <p className="py-10 text-center text-sm text-ink-3">…</p>;
  if (state.kind === "forbidden") {
    return (
      <Notice text={listing.errors.FORBIDDEN}>
        <Link href={`/listings/${userId}/${regDate}`} className="text-[13px] text-primary font-medium hover:underline">
          {listing.edit.back}
        </Link>
      </Notice>
    );
  }
  if (state.kind === "error") {
    return (
      <Notice text={t.loadFailed}>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
          className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
        >
          {t.retry}
        </button>
      </Notice>
    );
  }
  return <ListingEditForm detail={state.detail} />;
}

function Notice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="py-10 flex flex-col items-center gap-3 text-center">
      <p className="text-[15px] font-bold text-ink">{text}</p>
      {children}
    </div>
  );
}
