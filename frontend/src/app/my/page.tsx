import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { MyListings } from "@/components/my/MyListings";
import { MyProfile } from "@/components/my/MyProfile";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.page.title };

export default function MyPage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-[720px] mx-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1 px-1">
            <h1 className="text-xl font-bold">{my.page.title}</h1>
            <p className="text-[13px] text-ink-2">{my.page.subtitle}</p>
          </div>
          <div className="bg-surface border border-line rounded-md p-5 @md:p-6">
            <RequireLogin>
              <MyProfile />
              <h2 className="mb-3 text-[15px] font-bold">{my.listings.title}</h2>
              <MyListings />
            </RequireLogin>
          </div>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
