import { api } from "@/lib/api/client";
import { searchApiParams, type SearchQuery } from "@/lib/search";
import type { ListingDetail, ListingSearchPage } from "@/types/listing";

const path = (userId: string, regDate: string) => `/api/v1/listings/${userId}/${regDate}`;

export const listingsApi = {
  search: (query: SearchQuery, cursor?: string) =>
    api<ListingSearchPage>(`/api/v1/listings?${searchApiParams(query, cursor)}`, { cache: "no-store" }),
  get: (userId: string, regDate: string) => api<ListingDetail>(path(userId, regDate), { cache: "no-store" }),
  remove: (userId: string, regDate: string) => api<null>(path(userId, regDate), { method: "DELETE" }),
};
