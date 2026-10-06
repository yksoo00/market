import type { Metadata } from "next";
import Link from "next/link";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.purchases.title };

export default function MyPurchasesPage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-[720px] mx-auto flex flex-col gap-4">
          <h1 className="px-1 text-xl font-bold">{my.purchases.title}</h1>
          <div className="bg-surface border border-line rounded-md p-5 @md:p-6">
            <RequireLogin>
              <div className="py-10 flex flex-col items-center gap-2 text-center">
                <p className="text-[15px] font-bold text-ink">{my.purchases.emptyTitle}</p>
                <p className="text-[13px] text-ink-2">{my.purchases.emptyDesc}</p>
                <Link href="/search" className="text-[13px] text-primary font-medium hover:underline">
                  {my.purchases.toSearch}
                </Link>
              </div>
            </RequireLogin>
          </div>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
