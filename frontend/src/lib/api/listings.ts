import { post } from "@/lib/api/client";
import type { ApiResult } from "@/types/api";
import type { ListingCreateRequest, ListingCreated } from "@/types/listing";

export function createListing(req: ListingCreateRequest): Promise<ApiResult<ListingCreated>> {
  return post<ListingCreated>("/api/v1/listings", req);
}
