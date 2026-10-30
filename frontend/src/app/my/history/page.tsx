import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { HistoryList } from "@/components/my/HistoryList";
import { MyTabs } from "@/components/my/MyTabs";
import { filterParams } from "@/lib/detailFilter";
import { historyFields, parseHistoryFilter } from "@/lib/historyFilter";
import { HISTORY_TABS, parseHistoryTab, parsePage, tabPageHref } from "@/lib/myTabs";
import type { RawSearchParams } from "@/lib/search";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.history.title };

// 내 거래이력: 구매확정된 거래 기록 (trd_trade_history). 구매 = 내가 구매자, 판매 = 내가 판매자. 탭은 ?tab= (기본 all)
// 검색어·상세 필터(?q=&from=&to=&min=&max=&sort=)도 주소가 원본 — 탭을 바꿔도 유지, 바뀌면 key 로 목록을 다시 마운트
export default async function MyHistoryPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const tab = parseHistoryTab(raw.tab);
  const page = parsePage(raw.page);
  const filter = parseHistoryFilter(raw);
  const params = filterParams(historyFields, filter, "q");

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <h1 className="px-1 text-xl font-bold">{my.history.title}</h1>
          <MyTabs
            label={my.history.tabsLabel}
            current={tab}
            tabs={HISTORY_TABS.map((k) => ({ key: k, label: my.history.tabs[k], href: tabPageHref("/my/history", { tab: k, ...params }, 1) }))}
          />
          <RequireLogin>
            <HistoryList key={tabPageHref("/my/history", { tab, ...params }, 1)} side={tab} page={page} filter={filter} />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
