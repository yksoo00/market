import { api, fetchFile, upload } from "@/lib/api/client";
import { searchApiParams, type SearchQuery, type SearchScope } from "@/lib/search";
import type { BulkCheckResponse, BulkCommitResponse, BulkParseResponse, BulkRowApi } from "@/types/listingBulk";
import type { ListingCreated, ListingCreateRequest, ListingDetail, ListingMinePage, ListingSearchPage, ListingUpdateRequest } from "@/types/listing";

const path = (userId: string, regDate: string) => `/api/v1/listings/${userId}/${regDate}`;

export const listingsApi = {
  search: (query: SearchQuery, scope: SearchScope = "search") =>
    // 내 구매 범위는 거래 도메인이 내 거래 매물 안에서 같은 조건으로 찾는다 (응답 모양은 같다)
    api<ListingSearchPage>(`${query.purchased ? "/api/v1/trades/listings" : "/api/v1/listings"}?${searchApiParams(query, scope)}`, { cache: "no-store" }),
  get: (userId: string, regDate: string) => api<ListingDetail>(path(userId, regDate), { cache: "no-store" }),
  /** idempotencyKey: 폼을 연 동안 같은 값. 응답이 유실돼 다시 보내도 서버가 매물을 두 번 만들지 않게 (security.md "중복 생성 방지") */
  create: (req: ListingCreateRequest, idempotencyKey: string) =>
    api<ListingCreated>("/api/v1/listings", { method: "POST", body: JSON.stringify(req), headers: { "Idempotency-Key": idempotencyKey } }),
  /** 내 매물만 (로그인 필요). 판매정보 추가등록이 대상 매물을 고를 때 */
  mine: (cursor?: string) => api<ListingMinePage>(`/api/v1/listings/mine${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" }),
  update: (userId: string, regDate: string, patch: ListingUpdateRequest) =>
    api<ListingDetail>(path(userId, regDate), { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (userId: string, regDate: string) => api<null>(path(userId, regDate), { method: "DELETE" }),
};

/** 엑셀 다량 등록 (계획 2026-11-05-bulk-listing-excel.md). 서버는 줄 상태를 저장하지 않아 검사·확정 때마다 줄을 전부 보낸다 */
export const listingBulkApi = {
  /** zip: 엑셀 칸에 적은 파일명과 이름이 같은 사진·데이터시트를 묶은 ZIP (선택) */
  parse: (file: File, zip?: File | null) => {
    const form = new FormData();
    form.append("file", file);
    if (zip) form.append("attachments", zip);
    return upload<BulkParseResponse>("/api/v1/listings/bulk/parse", form);
  },
  check: (rows: BulkRowApi[]) => api<BulkCheckResponse>("/api/v1/listings/bulk/check", { method: "POST", body: JSON.stringify({ rows }) }),
  commit: (rows: BulkRowApi[]) => api<BulkCommitResponse>("/api/v1/listings/bulk/commit", { method: "POST", body: JSON.stringify({ rows }) }),
  template: () => fetchFile("/api/v1/listings/bulk/template"),
};
