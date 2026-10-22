import { api } from "@/lib/api/client";
import type { CartCount, CartItem } from "@/types/cart";

export const cartApi = {
  /** 1~20개. 이미 담긴 매물은 건너뛴다. 하나라도 틀리면 아무것도 안 담긴다. 응답은 담은 뒤 합계 */
  add: (items: { sellerId: string; regDate: string }[]) =>
    api<CartCount>("/api/v1/cart", { method: "POST", body: JSON.stringify({ items }) }),
  list: () => api<{ items: CartItem[] }>("/api/v1/cart", { cache: "no-store" }),
  count: () => api<CartCount>("/api/v1/cart/count", { cache: "no-store" }),
  /** 빼기 = 행 삭제 → 204 */
  remove: (tradeIds: string[]) =>
    api<null>("/api/v1/cart/remove", { method: "POST", body: JSON.stringify({ tradeIds }) }),
};
