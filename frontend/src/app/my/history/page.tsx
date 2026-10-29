import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { HistoryList } from "@/components/my/HistoryList";
import { MyTabs } from "@/components/my/MyTabs";
import { HISTORY_TABS, parseHistoryTab, parsePage } from "@/lib/myTabs";
import type { RawSearchParams } from "@/lib/search";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.history.title };

// 내 거래이력: 구매확정된 거래 기록 (trd_trade_history). 구매 = 내가 구매자, 판매 = 내가 판매자. 탭은 ?tab= (기본 all)
export default async function MyHistoryPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const tab = parseHistoryTab(raw.tab);
  const page = parsePage(raw.page);

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <h1 className="px-1 text-xl font-bold">{my.history.title}</h1>
          <MyTabs
            label={my.history.tabsLabel}
            current={tab}
            tabs={HISTORY_TABS.map((k) => ({ key: k, label: my.history.tabs[k], href: `/my/history?tab=${k}` }))}
          />
          <RequireLogin>
            <HistoryList key={tab} side={tab} page={page} />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
