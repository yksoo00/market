"use client";

import { ListingForm } from "@/components/listing/ListingForm";
import { listingsApi } from "@/lib/api/listings";
import { toCreateRequest } from "@/lib/listingForm";
import { emptyListingForm } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

// 서버 컴포넌트(page)는 함수를 클라이언트 컴포넌트에 넘길 수 없어 등록 API 연결을 여기서 한다
export function CreateListingForm() {
  return <ListingForm initialValues={emptyListingForm} submitLabel={listing.form.submit} onSubmit={(v) => listingsApi.create(toCreateRequest(v))} />;
}
