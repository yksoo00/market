"use client";

import { ListingEditForm } from "@/components/listing/ListingEditForm";
import { OwnedListingView } from "@/components/listing/OwnedListingView";

// 서버 컴포넌트(page)는 함수를 클라이언트 컴포넌트에 넘길 수 없어 폼 연결을 여기서 한다
export function EditListingView({ userId, regDate }: { userId: string; regDate: string }) {
  return <OwnedListingView userId={userId} regDate={regDate}>{(detail) => <ListingEditForm detail={detail} />}</OwnedListingView>;
}
