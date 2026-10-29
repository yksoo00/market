import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { CompareView } from "@/components/cart/CompareView";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { compare } from "@/messages/compare";

export const metadata: Metadata = { title: compare.page.title };

// 비교: 검색 목록의 [비교]가 저장한 내 비교 목록(같은 소분류 2~4개)을 나란히 (설계 2026-10-27 PR 3). 고른 상품은 주소가 아니라 서버가 들고 있다
export default function ComparePage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <h1 className="px-1 text-xl font-bold">{compare.page.title}</h1>
          <RequireLogin>
            <CompareView />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
