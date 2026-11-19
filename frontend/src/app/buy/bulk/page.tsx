import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { BuyBulkView } from "@/components/buy/BuyBulkView";
import { buyBulk } from "@/messages/buyBulk";

export const metadata: Metadata = { title: buyBulk.title };

export default function BuyBulkPage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-[1280px] mx-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1 px-1">
            <h1 className="text-xl font-bold">{buyBulk.title}</h1>
            <p className="text-[13px] text-ink-2">{buyBulk.subtitle}</p>
          </div>
          <RequireLogin>
            <BuyBulkView />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="/buy/bulk" />
    </>
  );
}
