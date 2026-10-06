import { MobileTabBar } from "@/components/common/MobileTabBar";
import { QuickMenu } from "@/components/home/QuickMenu";
import { RealtimeCard } from "@/components/home/RealtimeCard";
import { SearchBox } from "@/components/home/SearchBox";
import { buyRequests, sellListings } from "@/lib/mock/home";
import { home as t } from "@/messages/home";

export default function HomePage() {
  return (
    <>
      {/* 문구·검색·아이콘, 구매대행·경매 자리, 실시간 두 줄을 한 덩어리로 세로 가운데(태블릿 이상).
          실시간은 줄마다 카드가 옆으로 이어지고 가로 스크롤 — 높이가 고정이라 페이지는 세로 스크롤 없음 */}
      <main className="flex-1 min-h-0 px-4 @md:px-6 py-3 @md:py-5 flex flex-col @md:justify-center gap-3 @md:gap-6">
        <section className="shrink-0 w-full max-w-220 mx-auto flex flex-col gap-3 @md:gap-5">
          <h1 className="-mb-1 @md:-mb-2 text-center text-[17px] @md:text-xl font-bold text-ink">{t.tagline}</h1>
          <SearchBox />
          <QuickMenu />
        </section>

        {/* TODO(구매대행·경매 미정): 기능이 정해지면 이 자리에 넣는다. 지금은 자리만 비워 둔다 (사용자 지시) */}
        <div aria-hidden="true" className="shrink-0 w-full max-w-300 mx-auto h-14 @md:h-20 rounded-md border border-dashed border-line" />

        <div className="shrink-0 w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <RealtimeCard type="buy" items={buyRequests} />
          <RealtimeCard type="sell" items={sellListings} />
        </div>
      </main>

      <MobileTabBar active="/" />
    </>
  );
}
