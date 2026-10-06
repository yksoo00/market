"use client";

import { ExtraForm } from "@/components/listing/ExtraForm";
import { OwnedListingView } from "@/components/listing/OwnedListingView";

export function ExtraListingView({ userId, regDate }: { userId: string; regDate: string }) {
  return <OwnedListingView userId={userId} regDate={regDate}>{(detail) => <ExtraForm detail={detail} />}</OwnedListingView>;
}
