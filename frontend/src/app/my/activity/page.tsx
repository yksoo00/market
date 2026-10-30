import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { MyListingsView } from "@/components/my/MyListingsView";
import { MyTabs } from "@/components/my/MyTabs";
import { TradeList } from "@/components/trade/TradeList";
import { ACTIVITY_TABS, parseActivityTab, parsePage, parseReg } from "@/lib/myTabs";
import { buildSearchHref, parseSearchParams, type RawSearchParams } from "@/lib/search";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.activity.title };

// 내 활동내역: 요청(받은 견적·구매요청) · 판매(내 판매글) · 구매(보낸 견적·구매중). 진행 중인 것만 — 확정된 거래는 내 거래이력.
// 탭은 ?tab= (기본 requests). 판매 탭은 검색 결과 화면과 같은 부품이라 검색 조건이 같은 주소에 실린다
export default async function MyActivityPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const tab = parseActivityTab(raw.tab);
  const reg = parseReg(raw.reg);
  const page = parsePage(raw.page);
  // 판매 탭: 조건이 바뀌면 key 로 다시 마운트
  const query = parseSearchParams(raw, "mine");
  const key = buildSearchHref(query, "mine");

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-3 @md:pt-5">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4 pb-3 @md:pb-6">
          <h1 className="px-1 text-xl font-bold">{my.activity.title}</h1>
          <MyTabs
            label={my.activity.tabsLabel}
            current={tab}
            tabs={ACTIVITY_TABS.map((k) => ({ key: k, label: my.activity.tabs[k], href: `/my/activity?tab=${k}` }))}
          />
          <RequireLogin>
            {tab === "requests" && (
              <TradeList
                key={reg ?? "all"}
                role="seller"
                reg={reg}
                active
                page={page}
                pagePath="/my/activity"
                pageParams={{ tab: "requests", reg }}
              />
            )}
            {tab === "sales" && <MyListingsView query={query} viewKey={key} />}
            {tab === "purchases" && (
              <TradeList role="buyer" active page={page} pagePath="/my/activity" pageParams={{ tab: "purchases" }} />
            )}
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
