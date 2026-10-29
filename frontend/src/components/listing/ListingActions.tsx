"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { ResultDialog } from "@/components/common/ResultDialog";
import { CartDialog } from "@/components/trade/CartDialog";
import { PurchaseDialog } from "@/components/trade/PurchaseDialog";
import { QuoteDialog } from "@/components/trade/QuoteDialog";
import { listingsApi } from "@/lib/api/listings";
import { notifyCartChanged } from "@/lib/cart";
import { cartBlocked, ownerActions, purchaseBlockReason } from "@/lib/listingDetail";
import { cart } from "@/messages/cart";
import { listing } from "@/messages/listing";
import { trade } from "@/messages/trade";
import type { CartAddResult } from "@/types/cart";
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

/** 남의 매물: 견적 요청·구매. 내 매물: 수정·추가등록·삭제. 판매자 판단은 표시용 — 권한은 서버 403 */
export function ListingActions({ detail, owner, meId, anonymous, onPurchased }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const openTile = useTileOpen();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoted, setQuoted] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [added, setAdded] = useState<CartAddResult | null>(null);

  const block = purchaseBlockReason(detail, meId);
  const mine = ownerActions(detail);
  // 거래완료된 내 매물은 버튼이 하나도 없다 — 빈 줄을 남기지 않는다
  const showButtons = !owner || mine.edit || mine.extra || mine.remove;
  // [구매]·[견적 요청] 공통: 확인 중·확인 실패(meId null 이지만 anonymous 아님)면 모달을 연다 — 실제로 로그인이 풀렸으면 서버 401
  const openIfLoggedIn = (open: () => void) => {
    if (block === "login" && anonymous) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    open();
  };
  const buy = () => openIfLoggedIn(() => setBuying(true));
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
              {/* 견적도 구매와 같은 이유(거래완료·재고 부족)로 막는다. 장바구니는 거래완료·내 매물만 (cartBlocked) */}
              <button
                type="button"
                onClick={() => openIfLoggedIn(() => setCartOpen(true))}
                disabled={cartBlocked(detail, meId)}
                className={outline}
              >
                {cart.add.button}
              </button>
              <button
                type="button"
                onClick={() => openIfLoggedIn(() => setQuoting(true))}
                disabled={block !== null && block !== "login"}
                className={outline}
              >
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
            notifyCartChanged();
            setPurchased(true);
            onPurchased?.();
          }}
        />
      )}
      {!owner && cartOpen && (
        <CartDialog
          targets={[{ sellerId: detail.userId, regDate: detail.regDate }]}
          open
          onOpenChange={setCartOpen}
          onAdded={(result) => {
            notifyCartChanged();
            setAdded(result);
          }}
        />
      )}
      {!owner && quoting && (
        <QuoteDialog
          targets={[{ sellerId: detail.userId, regDate: detail.regDate }]}
          open
          onOpenChange={setQuoting}
          onRequested={() => {
            notifyCartChanged();
            setQuoted(true);
          }}
        />
      )}
      <ResultDialog
        open={quoted}
        tone="success"
        title={trade.quote.doneTitle}
        message={trade.quote.doneMessage}
        actionLabel={p.toPurchases}
        onAction={() => {
          setQuoted(false);
          openTile("/my/purchases", false);
        }}
        onClose={() => setQuoted(false)}
      />
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
      <ResultDialog
        open={added !== null}
        tone="success"
        title={cart.add.doneTitle}
        message={added && added.skipped > 0 ? `${cart.add.doneMessage}
${cart.add.skipped(added.skipped)}` : cart.add.doneMessage}
        actionLabel={cart.add.toCart}
        onAction={() => {
          setAdded(null);
          openTile("/my/cart", false);
        }}
        onClose={() => setAdded(null)}
      />
    </div>
  );
}
