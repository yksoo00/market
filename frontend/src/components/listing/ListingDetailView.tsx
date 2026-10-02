"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataSheetCard } from "@/components/listing/DataSheetCard";
import { ListingSummaryCard } from "@/components/listing/ListingSummaryCard";
import { PhotosCard } from "@/components/listing/PhotosCard";
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
  | { kind: "ready"; detail: ListingDetail; meId: string | null };

// 클라이언트 조회 (스펙 "결정": 판매자 판단·PDF 가 어차피 브라우저 몫이고 lib/api 가 유일한 호출 지점)
export function ListingDetailView({ userId, regDate }: { userId: string; regDate: string }) {
  const valid = isValidListingPath(userId, regDate);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    void Promise.all([listingsApi.get(userId, regDate), authApi.me()]).then(([res, me]) => {
      if (!alive) return;
      if (res.ok) setState({ kind: "ready", detail: res.data, meId: me.ok ? me.data.id : null });
      else setState({ kind: res.code === "LISTING_NOT_FOUND" ? "notFound" : "error" });
    });
    return () => {
      alive = false;
    };
  }, [userId, regDate, valid, attempt]);

  if (!valid || state.kind === "notFound") return <NotFound />;
  if (state.kind === "loading") return <Skeleton />;
  if (state.kind === "error") {
    const retry = () => {
      setState({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        <p className="text-[15px] font-bold text-ink">{t.loadFailed}</p>
        <button type="button" onClick={retry} className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft">
          {t.retry}
        </button>
      </div>
    );
  }

  const { detail, meId } = state;
  return (
    <>
      <ListingSummaryCard detail={detail} owner={isOwner(meId, detail.userId)} />
      <DataSheetCard detail={detail} loggedIn={meId !== null} />
      <PhotosCard photos={detail.photos} />
    </>
  );
}

function NotFound() {
  return (
    <div className="py-16 flex flex-col items-center gap-2 text-center">
      <p className="text-[15px] font-bold text-ink">{t.notFound}</p>
      <Link href="/search" className="text-[13px] text-primary font-medium hover:underline">
        {t.toSearch}
      </Link>
    </div>
  );
}

// 카드 3개(상세 내역·데이터시트·사진) 자리를 그대로 잡아 내용이 들어올 때 화면이 덜 흔들리게
function Skeleton() {
  return (
    <div className="flex flex-col gap-3 @md:gap-4 animate-pulse" aria-busy="true">
      <div className="h-120 rounded-md border border-line bg-line-2" />
      <div className="h-80 rounded-md border border-line bg-line-2" />
      <div className="h-40 rounded-md border border-line bg-line-2" />
    </div>
  );
}
