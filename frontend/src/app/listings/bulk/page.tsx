import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { BulkListingView } from "@/components/listing/BulkListingView";
import { listing } from "@/messages/listing";

export const metadata: Metadata = { title: listing.bulk.page.title };

export default function BulkListingPage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-[1280px] mx-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1 px-1">
            <h1 className="text-xl font-bold">{listing.bulk.page.title}</h1>
            <p className="text-[13px] text-ink-2">{listing.bulk.page.subtitle}</p>
          </div>
          <RequireLogin>
            <BulkListingView />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="/listings/bulk" />
    </>
  );
}
