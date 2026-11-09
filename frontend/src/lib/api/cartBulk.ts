import { api, fetchFile, upload } from "@/lib/api/client";
import type { BuySort, CartBulkCheckResponse, CartBulkCommitResponse, CartBulkParseResponse, CartBulkRowApi } from "@/types/cartBulk";

/** 엑셀 대량구매 (계획 2026-11-09-bulk-purchase-excel.md). 서버는 줄 상태를 저장하지 않아 검사·담기 때마다 줄을 전부 보낸다 */
export const cartBulkApi = {
  /** sort = 조건을 통과한 매물 중 기본으로 고르는 기준. check·commit 과 같은 값을 보내야 화면이 본 매물과 담기는 매물이 같다 */
  parse: (file: File, sort: BuySort) => {
    const form = new FormData();
    form.append("file", file);
    return upload<CartBulkParseResponse>(`/api/v1/cart/bulk/parse?sort=${sort}`, form);
  },
  check: (rows: CartBulkRowApi[], sort: BuySort) =>
    api<CartBulkCheckResponse>("/api/v1/cart/bulk/check", { method: "POST", body: JSON.stringify({ rows, sort }) }),
  /** 줄마다 따로 담는다 — 일부만 담길 수 있고 결과는 줄별이다 */
  commit: (rows: CartBulkRowApi[], sort: BuySort) =>
    api<CartBulkCommitResponse>("/api/v1/cart/bulk/commit", { method: "POST", body: JSON.stringify({ rows, sort }) }),
  template: () => fetchFile("/api/v1/cart/bulk/template"),
};
