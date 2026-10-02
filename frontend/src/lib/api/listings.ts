import { api } from "@/lib/api/client";
import type { ListingDetail } from "@/types/listing";

const path = (userId: string, regDate: string) => `/api/v1/listings/${userId}/${regDate}`;

export const listingsApi = {
  get: (userId: string, regDate: string) => api<ListingDetail>(path(userId, regDate), { cache: "no-store" }),
  remove: (userId: string, regDate: string) => api<null>(path(userId, regDate), { method: "DELETE" }),
};
