import Link from "next/link";
import { ListingCard } from "@/components/home/ListingCard";
import { home as t } from "@/messages/home";
import type { ListingSummary, ListingType } from "@/types/listing";

interface Props {
  type: ListingType;
  items: ListingSummary[];
}

// 한 줄에 카드를 옆으로 늘어놓고 가로 스크롤 (사용자 지시: 아래로 쌓지 않음).
// 높이가 카드 한 줄로 고정이라 홈 "스크롤 없이" 원칙은 세로 기준 그대로 지킨다
export function RealtimeCard({ type, items }: Props) {
  const isBuy = type === "buy";
  const title = isBuy ? t.buyRequests : t.sellListings;
  return (
    <section aria-label={title} className="min-w-0 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={`w-[7px] h-[7px] rounded-full ${isBuy ? "bg-green" : "bg-primary"}`} />
        <h2 className="text-sm font-bold">{title}</h2>
        <span className="grow" />
        <Link href={isBuy ? "/requests" : "/listings"} className="text-xs text-ink-2 hover:text-primary">
          {t.viewAll} ›
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-3 rounded-md border border-line bg-surface">{t.empty}</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto snap-x pb-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex">
              <ListingCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
