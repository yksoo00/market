import Link from "next/link";
import { formatPrice, formatRelative } from "@/lib/format";
import { home as t } from "@/messages/home";
import type { ListingSummary } from "@/types/listing";

export function ListingRow({ item }: { item: ListingSummary }) {
  const href = item.type === "buy" ? `/requests/${item.id}` : `/listings/${item.id}`;
  return (
    <Link href={href} className="h-14 shrink-0 flex flex-col justify-center gap-[3px] border-t border-line-2 text-ink">
      <span className="text-[13px] font-medium truncate">{item.title}</span>
      <span className="flex items-center gap-2 text-[11px] text-ink-3">
        <span className="num text-xs font-semibold text-ink">
          {formatPrice(item.price)}
          {item.price !== null && item.priceUnit}
        </span>
        <span className={item.sellerKind === "business" ? "text-primary-dark font-medium" : "text-ink-2 font-medium"}>
          {t.seller[item.sellerKind]}
        </span>
        <span>
          {item.category} · {item.quantity}개
        </span>
        <span className="grow" />
        <span>{formatRelative(item.createdAt)}</span>
      </span>
    </Link>
  );
}
