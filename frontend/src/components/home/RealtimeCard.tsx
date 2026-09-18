import Link from "next/link";
import { ListingRow } from "@/components/home/ListingRow";
import { home as t } from "@/messages/home";
import type { ListingSummary, ListingType } from "@/types/listing";

interface Props {
  type: ListingType;
  items: ListingSummary[];
}

export function RealtimeCard({ type, items }: Props) {
  const isBuy = type === "buy";
  return (
    <section className="flex-1 min-h-0 flex flex-col gap-1.5 bg-surface border border-line rounded-md px-3.5 pt-3 pb-1 overflow-hidden">
      <div className="flex items-center gap-2">
        <span className={`w-[7px] h-[7px] rounded-full ${isBuy ? "bg-green" : "bg-primary"}`} />
        <h2 className="text-sm font-bold">{isBuy ? t.buyRequests : t.sellListings}</h2>
        <span className="grow" />
        <Link href={isBuy ? "/requests" : "/listings"} className="text-xs text-ink-2 hover:text-primary">
          {t.viewAll} ›
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-3">{t.empty}</p>
      ) : (
        <div className="min-h-0 flex flex-col overflow-hidden">
          {items.map((item) => (
            <ListingRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
