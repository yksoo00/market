import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { TradeList } from "@/components/trade/TradeList";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.sales.title };

// 받은 구매요청: 내 매물에 들어온 거래. ?reg=<매물 regDate> 면 그 매물만 (내 판매글 표의 "구매요청 N건"에서 온다)
export default async function MySalesPage({ searchParams }: { searchParams: Promise<{ reg?: string | string[] }> }) {
  const { reg } = await searchParams;
  const listingReg = typeof reg === "string" && /^\d{14}$/.test(reg) ? reg : undefined;

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <h1 className="px-1 text-xl font-bold">{my.sales.title}</h1>
          <RequireLogin>
            <TradeList key={listingReg ?? "all"} role="seller" reg={listingReg} />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
