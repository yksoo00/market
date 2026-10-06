import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { MyListingsView } from "@/components/my/MyListingsView";
import { buildSearchHref, parseSearchParams, type RawSearchParams } from "@/lib/search";
import { my } from "@/messages/my";

export const metadata: Metadata = { title: my.mine.title };

// 내 판매글: 검색 결과 화면(/search)과 같은 부품에 scope="mine". 상태는 URL 쿼리 (조건이 바뀌면 key 로 다시 마운트)
export default async function MyListingsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseSearchParams(await searchParams, "mine");
  const key = buildSearchHref(query, "mine");

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-3 @md:pt-5">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4 pb-3 @md:pb-6">
          <h1 className="px-1 text-xl font-bold">{my.mine.title}</h1>
          <RequireLogin>
            <MyListingsView query={query} viewKey={key} />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
