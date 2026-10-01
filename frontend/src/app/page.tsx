import { MobileTabBar } from "@/components/common/MobileTabBar";
import { QuickMenu } from "@/components/home/QuickMenu";
import { RealtimeCard } from "@/components/home/RealtimeCard";
import { RealtimeTabs } from "@/components/home/RealtimeTabs";
import { SearchBox } from "@/components/home/SearchBox";
import { buyRequests, sellListings } from "@/lib/mock/home";
import { home as t } from "@/messages/home";

export default function HomePage() {
  return (
    <>
      {/* 위: 문구·검색·아이콘이 남은 높이의 세로 가운데. 아래: 실시간 목록은 높이의 2/5 (화면이 낮으면 목록이 먼저 줄어듦).
          페이지는 스크롤 없음 */}
      <main className="flex-1 min-h-0 px-4 @md:px-6 py-3 @md:py-5 flex flex-col gap-3 @md:gap-5">
        <section className="shrink-0 @md:grow w-full max-w-220 mx-auto flex flex-col @md:justify-center gap-3 @md:gap-5">
          <h1 className="-mb-1 @md:-mb-2 text-center text-[17px] @md:text-xl font-bold text-ink">{t.tagline}</h1>
          <SearchBox />
          <QuickMenu />
        </section>

        <div className="hidden @md:flex basis-2/5 min-h-0 w-full max-w-300 mx-auto gap-4">
          <RealtimeCard type="buy" items={buyRequests} />
          <RealtimeCard type="sell" items={sellListings} />
        </div>

        <div className="@md:hidden flex-1 min-h-0 flex flex-col">
          <RealtimeTabs buy={buyRequests} sell={sellListings} />
        </div>
      </main>

      <MobileTabBar active="/" />
    </>
  );
}
