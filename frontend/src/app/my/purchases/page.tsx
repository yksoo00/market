import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { TradeList } from "@/components/trade/TradeList";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.purchases.title };

// 내 구매목록: 내가 구매자인 거래. 구매요청 행에서 [거래완료]·[취소]
export default function MyPurchasesPage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <h1 className="px-1 text-xl font-bold">{my.purchases.title}</h1>
          <RequireLogin>
            <TradeList role="buyer" />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
