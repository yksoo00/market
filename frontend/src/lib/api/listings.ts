import { api } from "@/lib/api/client";
import { searchApiParams, type SearchQuery } from "@/lib/search";
import type { ListingCreated, ListingCreateRequest, ListingDetail, ListingSearchPage, ListingUpdateRequest } from "@/types/listing";

const path = (userId: string, regDate: string) => `/api/v1/listings/${userId}/${regDate}`;

export const listingsApi = {
  search: (query: SearchQuery, cursor?: string) =>
    api<ListingSearchPage>(`/api/v1/listings?${searchApiParams(query, cursor)}`, { cache: "no-store" }),
  get: (userId: string, regDate: string) => api<ListingDetail>(path(userId, regDate), { cache: "no-store" }),
  /** idempotencyKey: 폼을 연 동안 같은 값. 응답이 유실돼 다시 보내도 서버가 매물을 두 번 만들지 않게 (security.md "중복 생성 방지") */
  create: (req: ListingCreateRequest, idempotencyKey: string) =>
    api<ListingCreated>("/api/v1/listings", { method: "POST", body: JSON.stringify(req), headers: { "Idempotency-Key": idempotencyKey } }),
  update: (userId: string, regDate: string, patch: ListingUpdateRequest) =>
    api<ListingDetail>(path(userId, regDate), { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (userId: string, regDate: string) => api<null>(path(userId, regDate), { method: "DELETE" }),
};
