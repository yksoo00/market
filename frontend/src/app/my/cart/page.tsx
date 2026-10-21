import type { Metadata } from "next";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { CartView } from "@/components/cart/CartView";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { cart } from "@/messages/cart";

export const metadata: Metadata = { title: cart.page.title };

// 장바구니: 담아 둔 매물을 골라 [견적 요청]·[구매]·[빼기] (스펙 2026-10-21)
export default function MyCartPage() {
  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4">
          <h1 className="px-1 text-xl font-bold">{cart.page.title}</h1>
          <RequireLogin>
            <CartView />
          </RequireLogin>
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
