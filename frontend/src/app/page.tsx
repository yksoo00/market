import { Header } from "@/components/common/Header";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { QuickMenu } from "@/components/home/QuickMenu";
import { RealtimeCard } from "@/components/home/RealtimeCard";
import { RealtimeTabs } from "@/components/home/RealtimeTabs";
import { SearchBox } from "@/components/home/SearchBox";
import { buyRequests, sellListings } from "@/lib/mock/home";

export default function HomePage() {
  return (
    <>
      <Header />

      <main className="flex-1 min-h-0 px-4 md:px-6 py-3 md:py-5 flex flex-col gap-3 md:gap-4 lg:grid lg:grid-cols-[7fr_3fr] lg:gap-6">
        <section className="min-w-0 flex flex-col gap-4 lg:items-center lg:justify-center lg:pb-10">
          <div className="w-full lg:max-w-[760px] flex flex-col gap-4 md:gap-7">
            <SearchBox />
            <QuickMenu />
          </div>
        </section>

        <div className="hidden lg:flex min-w-0 min-h-0 flex-col gap-4">
          <RealtimeCard type="buy" items={buyRequests} />
          <RealtimeCard type="sell" items={sellListings} />
        </div>

        <div className="lg:hidden flex-1 min-h-0 flex flex-col">
          <RealtimeTabs buy={buyRequests} sell={sellListings} />
        </div>
      </main>

      <MobileTabBar active="/" />
    </>
  );
}
