"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { ResultDialog } from "@/components/common/ResultDialog";
import { PurchaseDialog } from "@/components/trade/PurchaseDialog";
import { listingsApi } from "@/lib/api/listings";
import { buyerActionsDisabled, ownerActions, purchaseBlockReason } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import { trade } from "@/messages/trade";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;
const p = trade.purchase;
const outline =
  "h-8.5 px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft disabled:opacity-40 disabled:pointer-events-none";
const filled =
  "h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none";

interface Props {
  detail: ListingDetail;
  owner: boolean;
  /** 로그인한 사용자 id. 모르면(확인 중·실패) null */
  meId: string | null;
  /** 로그인 안 한 것이 확실할 때만 true — [구매]가 로그인으로 보낸다 */
  anonymous: boolean;
  /** 구매요청 성공 — 상세가 재고를 다시 읽게 */
  onPurchased?: () => void;
}

/** 남의 매물: 견적 요청(준비 중)·구매. 내 매물: 수정·추가등록·삭제. 판매자 판단은 표시용 — 권한은 서버 403 */
export function ListingActions({ detail, owner, meId, anonymous, onPurchased }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const openTile = useTileOpen();
  // seq: 같은 문구가 연달아 나와도 알림 요소를 새로 그려 스크린리더가 다시 읽게 한다 (key 로 사용)
  const [notice, setNotice] = useState<{ seq: number; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [purchased, setPurchased] = useState(false);

  // TODO(견적 흐름 미정, decisions.md 미정 항목): 정해지면 실제 동작으로 교체
  const pending = (text: string) => setNotice((prev) => ({ seq: (prev?.seq ?? 0) + 1, text }));

  const block = purchaseBlockReason(detail, meId);
  const mine = ownerActions(detail);
  // 거래완료된 내 매물은 버튼이 하나도 없다 — 빈 줄을 남기지 않는다
  const showButtons = !owner || mine.edit || mine.extra || mine.remove;
  const buy = () => {
    // 확인 중·확인 실패(meId null 이지만 anonymous 아님)면 모달을 연다 — 실제로 로그인이 풀렸으면 서버 401
    if (block === "login" && anonymous) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBuying(true);
  };

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
      {showButtons && (
        <div className="flex flex-wrap items-center gap-2">
          {owner ? (
            <>
              {mine.edit && (
                <Link href={`/listings/${detail.userId}/${detail.regDate}/edit`} className={`${outline} inline-flex items-center`}>
                  {t.edit}
                </Link>
              )}
              {mine.extra && (
                <Link href={`/listings/${detail.userId}/${detail.regDate}/extra`} className={`${outline} inline-flex items-center`}>
                  {t.addExtra}
                </Link>
              )}
              {mine.remove && (
                <button type="button" onClick={remove} disabled={deleting} className={filled}>
                  {t.remove}
                </button>
              )}
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
              <button type="button" onClick={buy} disabled={block !== null && block !== "login"} className={filled}>
                {t.buy}
              </button>
              {block !== null && block !== "login" && <span className="text-[13px] text-ink-2">{p.blocked[block]}</span>}
            </>
          )}
        </div>
      )}
      {!owner && (
        <PurchaseDialog
          sellerId={detail.userId}
          regDate={detail.regDate}
          open={buying}
          onOpenChange={setBuying}
          onPurchased={() => {
            setPurchased(true);
            onPurchased?.();
          }}
        />
      )}
      <ResultDialog
        open={purchased}
        tone="success"
        title={p.doneTitle}
        message={p.doneMessage}
        actionLabel={p.toPurchases}
        onAction={() => {
          setPurchased(false);
          openTile("/my/purchases", false);
        }}
        onClose={() => setPurchased(false)}
      />
    </div>
  );
}
