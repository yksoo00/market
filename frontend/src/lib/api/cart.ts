import { api } from "@/lib/api/client";
import type { CartAddItem, CartAddResult, CartCount, CartItem } from "@/types/cart";

export const cartApi = {
  /** 1~20개, 매물마다 수량·납품희망일·요청사항. 이미 담긴 매물은 건너뛴다(skipped). 하나라도 틀리면 아무것도 안 담긴다 */
  add: (items: CartAddItem[]) => api<CartAddResult>("/api/v1/cart", { method: "POST", body: JSON.stringify({ items }) }),
  list: () => api<{ items: CartItem[] }>("/api/v1/cart", { cache: "no-store" }),
  count: () => api<CartCount>("/api/v1/cart/count", { cache: "no-store" }),
  /** 빼기 = 행 삭제 → 204 */
  remove: (tradeIds: string[]) =>
    api<null>("/api/v1/cart/remove", { method: "POST", body: JSON.stringify({ tradeIds }) }),
  /** [비교] — 내 비교 목록을 이 매물들로 바꾼다 (2~4개, 같은 소분류). 틀리면 이전 목록이 그대로 */
  replaceCompare: (items: { sellerId: string; regDate: string }[]) =>
    api<CartCount>("/api/v1/cart/compare", { method: "PUT", body: JSON.stringify({ items }) }),
  listCompare: () => api<{ items: CartItem[] }>("/api/v1/cart/compare", { cache: "no-store" }),
  removeCompare: (tradeIds: string[]) =>
    api<null>("/api/v1/cart/compare/remove", { method: "POST", body: JSON.stringify({ tradeIds }) }),
};
