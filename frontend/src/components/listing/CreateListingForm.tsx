"use client";

import { useState } from "react";
import { ListingForm } from "@/components/listing/ListingForm";
import { listingsApi } from "@/lib/api/listings";
import { toCreateRequest } from "@/lib/listingForm";
import { emptyListingForm } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

// 서버 컴포넌트(page)는 함수를 클라이언트 컴포넌트에 넘길 수 없어 등록 API 연결을 여기서 한다
export function CreateListingForm() {
  // 폼을 연 동안 같은 키. 실패한 요청의 키는 서버가 풀어 고쳐 다시 내도 되고, 응답이 유실된 등록을
  // 다시 보내면 서버가 처음 매물을 돌려준다. 실패 뒤 키를 바꾸면(예: 429) 유실된 첫 등록과 겹쳐 두 개가 생긴다
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <ListingForm
      initialValues={emptyListingForm}
      submitLabel={listing.form.submit}
      secondarySubmitLabel={listing.form.submitAndExtra}
      onSubmit={(v) => listingsApi.create(toCreateRequest(v), idempotencyKey)}
    />
  );
}
