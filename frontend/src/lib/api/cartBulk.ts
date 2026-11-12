import { api, fetchFile, upload } from "@/lib/api/client";
import type { CartBulkCheckResponse, CartBulkCommitResponse, CartBulkParseResponse, CartBulkRowApi } from "@/types/cartBulk";

/** 엑셀 대량구매 (계획 2026-11-09-bulk-purchase-excel.md). 서버는 줄 상태를 저장하지 않아 검사·담기 때마다 줄을 전부 보낸다 */
export const cartBulkApi = {
  parse: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<CartBulkParseResponse>("/api/v1/cart/bulk/parse", form);
  },
  check: (rows: CartBulkRowApi[]) => api<CartBulkCheckResponse>("/api/v1/cart/bulk/check", { method: "POST", body: JSON.stringify({ rows }) }),
  /** 줄마다 따로 담는다 — 일부만 담길 수 있고 결과는 줄별이다 */
  commit: (rows: CartBulkRowApi[]) => api<CartBulkCommitResponse>("/api/v1/cart/bulk/commit", { method: "POST", body: JSON.stringify({ rows }) }),
  template: () => fetchFile("/api/v1/cart/bulk/template"),
};
