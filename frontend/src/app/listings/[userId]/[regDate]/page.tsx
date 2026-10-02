import { MobileTabBar } from "@/components/common/MobileTabBar";
import { ListingDetailView } from "@/components/listing/ListingDetailView";

export default async function ListingDetailPage({ params }: { params: Promise<{ userId: string; regDate: string }> }) {
  const { userId, regDate } = await params;

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-3 @md:pt-5">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4 pb-3 @md:pb-6">
          <ListingDetailView userId={userId} regDate={regDate} />
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
