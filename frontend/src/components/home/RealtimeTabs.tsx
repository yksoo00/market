"use client";

import Link from "next/link";
import { useState } from "react";
import { ListingRow } from "@/components/home/ListingRow";
import { home as t } from "@/messages/home";
import type { ListingSummary, ListingType } from "@/types/listing";

interface Props {
  buy: ListingSummary[];
  sell: ListingSummary[];
}

// 모바일: 두 목록을 한 화면에 못 놓으므로 탭으로
export function RealtimeTabs({ buy, sell }: Props) {
  const [tab, setTab] = useState<ListingType>("buy");
  const items = tab === "buy" ? buy : sell;

  return (
    <section className="flex-1 min-h-0 flex flex-col">
      <div role="tablist" className="flex items-end border-b border-line text-[13px]">
        {(["buy", "sell"] as const).map((type) => (
          <button
            key={type}
            role="tab"
            type="button"
            aria-selected={tab === type}
            onClick={() => setTab(type)}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === type ? "border-ink font-bold text-ink" : "border-transparent text-ink-2"
            }`}
          >
            {type === "buy" ? t.buyRequests : t.sellListings}
          </button>
        ))}
        <span className="grow" />
        <Link href={tab === "buy" ? "/requests" : "/listings"} className="px-1 py-2 text-xs text-ink-2">
          {t.viewAll} ›
        </Link>
      </div>
      <div className="min-h-0 flex flex-col overflow-hidden bg-surface -mx-4 px-4">
        {items.map((item) => (
          <ListingRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
