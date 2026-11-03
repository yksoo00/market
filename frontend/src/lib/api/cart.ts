import { api } from "@/lib/api/client";
import type { CartAddItem, CartAddResult, CartCount, CartItem, CartQuantityResult } from "@/types/cart";

export const cartApi = {
  /** 1~20개, 매물마다 수량·납품희망일·요청사항. 이미 담긴 매물은 건너뛴다(skipped). 하나라도 틀리면 아무것도 안 담긴다 */
  add: (items: CartAddItem[]) => api<CartAddResult>("/api/v1/cart", { method: "POST", body: JSON.stringify({ items }) }),
  list: () => api<{ items: CartItem[] }>("/api/v1/cart", { cache: "no-store" }),
  count: () => api<CartCount>("/api/v1/cart/count", { cache: "no-store" }),
  /** +/- — 담은 수량을 이 값으로 바꾼다. 늘린 만큼만 재고를 더 묶고 줄인 만큼만 푼다. 담은 시각(1시간)은 그대로 */
  changeQuantity: (tradeId: string, orderQuantity: number) =>
    api<CartQuantityResult>(`/api/v1/cart/${encodeURIComponent(tradeId)}`, { method: "PATCH", body: JSON.stringify({ orderQuantity }) }),
  /** 빼기 = 행 삭제 → 204 */
  remove: (tradeIds: string[]) =>
    api<null>("/api/v1/cart/remove", { method: "POST", body: JSON.stringify({ tradeIds }) }),
  /** [비교에 담기] — 내 비교 목록에 더한다 (합쳐 4개까지, 같은 소분류). 이미 담긴 매물은 건너뛴다(added 에 안 센다). 틀리면 아무것도 안 담는다 */
  addCompare: (items: { sellerId: string; regDate: string }[]) =>
    api<CartAddResult>("/api/v1/cart/compare", { method: "POST", body: JSON.stringify({ items }) }),
  /** [비우고 새로 담기] — 내 비교 목록을 이 매물들로 바꾼다 (1~4개, 같은 소분류). 틀리면 이전 목록이 그대로 */
  replaceCompare: (items: { sellerId: string; regDate: string }[]) =>
    api<CartCount>("/api/v1/cart/compare", { method: "PUT", body: JSON.stringify({ items }) }),
  /** [비교 비우기] → 204 */
  clearCompare: () => api<null>("/api/v1/cart/compare", { method: "DELETE" }),
  listCompare: () => api<{ items: CartItem[] }>("/api/v1/cart/compare", { cache: "no-store" }),
  removeCompare: (tradeIds: string[]) =>
    api<null>("/api/v1/cart/compare/remove", { method: "POST", body: JSON.stringify({ tradeIds }) }),
};
