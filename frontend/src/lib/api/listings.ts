import { api } from "@/lib/api/client";
import { searchApiParams, type SearchQuery, type SearchScope } from "@/lib/search";
import type { ListingCreated, ListingCreateRequest, ListingDetail, ListingMinePage, ListingSearchPage, ListingUpdateRequest } from "@/types/listing";

const path = (userId: string, regDate: string) => `/api/v1/listings/${userId}/${regDate}`;

export const listingsApi = {
  search: (query: SearchQuery, cursor?: string, scope: SearchScope = "search") =>
    api<ListingSearchPage>(`/api/v1/listings?${searchApiParams(query, cursor, scope)}`, { cache: "no-store" }),
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
