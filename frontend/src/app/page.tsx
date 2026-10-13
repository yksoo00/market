import { MobileTabBar } from "@/components/common/MobileTabBar";
import { SearchBox } from "@/components/home/SearchBox";
import { home as t } from "@/messages/home";

export default function HomePage() {
  return (
    <>
      {/* 문구 + 검색창만 가운데 (구글 첫 화면처럼, 사용자 지시 2026-10-13). 판매·구매 아이콘은 헤더 앱 메뉴(∷)로 옮겼고
          실시간 목록·구매대행·경매 자리는 뺐다. 아래 여백(16vh)으로 가운데를 조금 위로. 내용이 칸보다 길 때(가로 휴대폰·큰 배율·1/4 칸)만 스크롤 — 평소엔 생기지 않는다 */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-4 pb-[16vh] flex flex-col justify-center-safe">
        <section className="w-full max-w-220 mx-auto flex flex-col gap-3 @md:gap-5">
          <h1 className="-mb-1 @md:-mb-2 text-center text-[17px] @md:text-xl font-bold text-ink">{t.tagline}</h1>
          <SearchBox />
        </section>
      </main>

      <MobileTabBar active="/" />
    </>
  );
}
