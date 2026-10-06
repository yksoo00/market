import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { ExtraPicker } from "@/components/listing/ExtraPicker";
import { listing } from "@/messages/listing";

export const metadata: Metadata = { title: listing.extra.pickTitle };

export default function ExtraPickPage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-[720px] mx-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1 px-1">
            <h1 className="text-xl font-bold">{listing.extra.pickTitle}</h1>
            <p className="text-[13px] text-ink-2">{listing.extra.pickSubtitle}</p>
          </div>
          <div className="bg-surface border border-line rounded-md p-4 @md:p-5">
            <RequireLogin>
              <ExtraPicker />
            </RequireLogin>
          </div>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
