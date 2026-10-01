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
      {/* 태블릿 이상: 문구·검색·아이콘과 실시간 목록을 한 덩어리로 세로 가운데에 두고 사이 간격은 고정.
          목록은 행 내용만큼만 차지하되 높이의 2/5를 넘지 않는다 (화면이 낮으면 목록이 먼저 줄어듦).
          화면이 커져도(배율 100% 등) 배치·간격은 그대로, 배경만 넓어진다. 페이지는 스크롤 없음 */}
      <main className="flex-1 min-h-0 px-4 @md:px-6 py-3 @md:py-5 flex flex-col @md:justify-center gap-3 @md:gap-8">
        <section className="shrink-0 w-full max-w-220 mx-auto flex flex-col gap-3 @md:gap-5">
          <h1 className="-mb-1 @md:-mb-2 text-center text-[17px] @md:text-xl font-bold text-ink">{t.tagline}</h1>
          <SearchBox />
          <QuickMenu />
        </section>

        <div className="hidden @md:flex min-h-0 max-h-[40%] w-full max-w-300 mx-auto gap-4">
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
