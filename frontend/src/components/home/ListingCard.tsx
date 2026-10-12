import Link from "next/link";
import { formatPrice, formatRelative } from "@/lib/format";
import { home as t } from "@/messages/home";
import type { ListingSummary } from "@/types/listing";

/** 실시간 목록 한 칸. 줄 안에서 옆으로 이어지는 작은 카드 (design.md "실시간 목록") */
export function ListingCard({ item }: { item: ListingSummary }) {
  const href = item.type === "buy" ? `/requests/${item.id}` : `/listings/${item.id}`;
  return (
    <Link
      href={href}
      className="w-56 shrink-0 snap-start flex flex-col gap-1.5 px-3.5 py-3 rounded-xl bg-surface text-ink ring-1 ring-line/70 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(24,24,27,0.18)] active:scale-[0.98]"
    >
      <span className="text-[13px] font-medium truncate">{item.title}</span>
      <span className="num text-[13px] font-semibold tracking-tight">
        {formatPrice(item.price)}
        {item.price !== null && item.priceUnit}
      </span>
      <span className="flex items-center gap-1.5 text-[11px] text-ink-3 min-w-0">
        <span className={`shrink-0 font-medium ${item.sellerKind === "business" ? "text-primary-dark" : "text-ink-2"}`}>
          {t.seller[item.sellerKind]}
        </span>
        <span className="truncate">
          {item.category} · {item.quantity}개
        </span>
        <span className="grow" />
        <span className="shrink-0">{formatRelative(item.createdAt)}</span>
      </span>
    </Link>
  );
}
