import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { CompareView } from "@/components/cart/CompareView";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { compare } from "@/messages/compare";

export const metadata: Metadata = { title: compare.page.title };

// 장바구니 비교: 같은 소분류 2~4개를 나란히 (계획 2026-10-22-cart-compare). 고른 상품은 주소 items 에만 있다
export default async function CartComparePage({ searchParams }: { searchParams: Promise<{ items?: string | string[] }> }) {
  const { items } = await searchParams;
  const raw = typeof items === "string" ? items : null;

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <h1 className="px-1 text-xl font-bold">{compare.page.title}</h1>
          <RequireLogin>
            <CompareView key={raw ?? ""} raw={raw} />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
