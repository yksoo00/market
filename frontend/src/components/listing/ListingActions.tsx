"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { listingsApi } from "@/lib/api/listings";
import { buyerActionsDisabled } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;
const outline =
  "h-8.5 px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none";
const filled =
  "h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none";

/** 남의 매물: 견적 요청·구매(준비 중). 내 매물: 수정(준비 중)·삭제. 판매자 판단은 표시용 — 권한은 서버 403 */
export function ListingActions({ detail, owner }: { detail: ListingDetail; owner: boolean }) {
  const router = useRouter();
  // seq: 같은 문구가 연달아 나와도 알림 요소를 새로 그려 스크린리더가 다시 읽게 한다 (key 로 사용)
  const [notice, setNotice] = useState<{ seq: number; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TODO(거래 흐름·수정 화면 미정, decisions.md 미정 항목): 정해지면 실제 동작으로 교체
  const pending = (text: string) => setNotice((prev) => ({ seq: (prev?.seq ?? 0) + 1, text }));

  const remove = async () => {
    if (!window.confirm(t.confirmDelete)) return;
    setDeleting(true);
    setError(null);
    const result = await listingsApi.remove(detail.userId, detail.regDate);
    if (result.ok) {
      router.push("/search");
      return;
    }
    setDeleting(false);
    setError(listing.errors[result.code] ?? result.message);
  };

  return (
    <div className="flex flex-col gap-2">
      {notice && (
        <div key={notice.seq} role="status" className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className="min-w-0">{notice.text}</span>
          <button type="button" aria-label={t.dismiss} onClick={() => setNotice(null)} className="shrink-0 text-ink-3 hover:text-ink">
            <Icon name="close" size={14} strokeWidth={2} />
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {owner ? (
          <>
            <Link href={`/listings/${detail.userId}/${detail.regDate}/edit`} className={`${outline} inline-flex items-center`}>
              {t.edit}
            </Link>
            <Link href={`/listings/${detail.userId}/${detail.regDate}/extra`} className={`${outline} inline-flex items-center`}>
              {t.addExtra}
            </Link>
            <button type="button" onClick={remove} disabled={deleting} className={filled}>
              {t.remove}
            </button>
            {error && (
              <span role="alert" className="text-[13px] text-down">
                {error}
              </span>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={() => pending(t.pendingTrade)} disabled={buyerActionsDisabled(detail)} className={outline}>
              {t.quote}
            </button>
            <button type="button" onClick={() => pending(t.pendingTrade)} disabled={buyerActionsDisabled(detail)} className={filled}>
              {t.buy}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
