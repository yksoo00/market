import { QuickMenu } from "@/components/home/QuickMenu";
import { RealtimeTabs } from "@/components/home/RealtimeTabs";
import { SearchBox } from "@/components/home/SearchBox";
import { buyRequests, sellListings } from "@/lib/mock/home";
import { home as t } from "@/messages/home";

export function HomeAuthPane() {
  return (
    <div className="h-full min-h-0 flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 lg:gap-6">
        <h1 className="text-center text-lg lg:text-xl font-bold text-ink">{t.tagline}</h1>
        <SearchBox />
        <QuickMenu />
      </div>
      <div className="flex-1 min-h-0">
        <RealtimeTabs buy={buyRequests} sell={sellListings} />
      </div>
    </div>
  );
}
